import os
import re
from datetime import datetime


def load_progress(pm_dir: str) -> dict:
    path = os.path.join(pm_dir, "PROGRESS.md")
    if not os.path.exists(path):
        return {"error": "PROGRESS.md not found"}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    completed = len(re.findall(r"✅", content))
    total = len(re.findall(r"[⬜✅]", content))
    mtime = os.path.getmtime(path)
    updated = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
    progress_pct = round(completed / total * 100, 1) if total > 0 else 0
    return {
        "content": content,
        "stats": {"completed": completed, "total": total, "progress_pct": progress_pct},
        "file": "PROGRESS.md",
        "updated": updated,
    }


def load_blockers(pm_dir: str) -> dict:
    path = os.path.join(pm_dir, "BLOCKER.md")
    if not os.path.exists(path):
        return {"error": "BLOCKER.md not found"}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    active = len(re.findall(r"⬜|🚫|BL-", content))
    resolved = len(re.findall(r"✅", content))
    return {
        "content": content,
        "file": "BLOCKER.md",
        "stats": {"active": active, "resolved": resolved},
    }


def load_runbook(pm_dir: str) -> dict:
    path = os.path.join(pm_dir, "RUNBOOK.md")
    if not os.path.exists(path):
        return {"error": "RUNBOOK.md not found"}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    return {"content": content, "file": "RUNBOOK.md"}
