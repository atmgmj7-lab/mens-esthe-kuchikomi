#!/usr/bin/env python3
"""Create a deterministic manifest for the exact Xserver deployment stage."""

from __future__ import annotations

import hashlib
import os
import stat
import sys
from pathlib import Path


def fail(message: str) -> None:
    raise SystemExit(f"ACTUAL_DEPLOY_MANIFEST=FAIL {message}")


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: generate-xserver-deploy-manifest.py STAGE_DIR OUTPUT")

    stage = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    if not stage.is_dir():
        fail("stage directory is missing")
    if output == stage or stage in output.parents:
        fail("manifest output must remain outside the deployment stage")

    rows: list[tuple[str, int, str]] = []
    for root, directories, filenames in os.walk(stage, topdown=True, followlinks=False):
        root_path = Path(root)
        for name in directories:
            candidate = root_path / name
            if candidate.is_symlink():
                fail("stage contains a symlink")
            if not candidate.is_dir():
                fail("stage contains an unsupported directory entry")
        for name in filenames:
            candidate = root_path / name
            relative = candidate.relative_to(stage).as_posix()
            if any(character in relative for character in ("\t", "\r", "\n")):
                fail("stage path contains a control character")
            mode = candidate.lstat().st_mode
            if stat.S_ISLNK(mode) or not stat.S_ISREG(mode):
                fail("stage contains a non-regular file")
            rows.append((digest(candidate), candidate.stat().st_size, relative))

    rows.sort(key=lambda row: row[2].encode("utf-8"))
    if not rows:
        fail("stage is empty")
    if len({row[2] for row in rows}) != len(rows):
        fail("stage contains duplicate paths")

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.tmp")
    with temporary.open("x", encoding="utf-8", newline="\n") as handle:
        for sha256, size, relative in rows:
            handle.write(f"{sha256}\t{size}\t{relative}\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.chmod(0o600)
    temporary.replace(output)
    print(f"ACTUAL_DEPLOY_MANIFEST=PASS files={len(rows)}")


if __name__ == "__main__":
    main()
