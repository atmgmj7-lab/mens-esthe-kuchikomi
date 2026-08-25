"""Command-line entrypoint for the local-only coverage batch dry-run."""

import argparse
import json
from pathlib import Path
from typing import Callable, Optional, Sequence

from .artifacts import write_handoff_artifacts, write_manifest
from .compiler import compile_batch
from .dryrun import dry_run
from .wordpress_snapshot import fetch_public_snapshot


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--actions", required=True, type=Path)
    parser.add_argument("--proposed", required=True, type=Path)
    parser.add_argument("--w3-final", required=True, type=Path)
    parser.add_argument("--w3-proposed", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--base-url", default="https://mens-esthe-kuchikomi.com"
    )
    parser.add_argument("--timeout", default=45.0, type=float)
    return parser


def main(
    argv: Optional[Sequence[str]] = None,
    snapshot_fetcher: Callable = fetch_public_snapshot,
) -> int:
    args = _parser().parse_args(argv)
    batch = compile_batch(
        args.actions,
        args.proposed,
        (args.w3_final, args.w3_proposed),
    )
    snapshot = snapshot_fetcher(args.base_url, args.timeout, 3)
    result = dry_run(batch, snapshot)
    if result.status != "COMPLETE":
        raise RuntimeError(f"dry-run blocked: {result.status}")
    write_manifest(batch, result, args.manifest)
    write_handoff_artifacts(batch, result, args.output_dir)
    print(
        json.dumps(
            {
                "status": result.status,
                "candidate_rows": result.candidate_row_count,
                "execution_entities": len(result.entity_results),
                "pilot_operations": len(batch.pilot_operations),
                "pilot_candidate_area_rows": len(batch.pilot_candidate_rows),
                "duplicate_shop_count": result.duplicate_shop_count,
                "duplicate_relation_count": result.duplicate_relation_count,
                "double_update_count": result.double_update_count,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
