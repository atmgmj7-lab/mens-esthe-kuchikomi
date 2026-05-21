import os
import re
from datetime import datetime


def generate_obsidian_note(pm_dir: str, obsidian_dir: str) -> dict:
    progress_path = os.path.join(pm_dir, "PROGRESS.md")
    blocker_path = os.path.join(pm_dir, "BLOCKER.md")
    if not os.path.exists(progress_path):
        return {"success": False, "error": "PROGRESS.md not found"}

    with open(progress_path, "r", encoding="utf-8") as f:
        p_content = f.read()

    if os.path.exists(blocker_path):
        with open(blocker_path, "r", encoding="utf-8") as f:
            f.read()

    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d-%H%M")
    filename = f"mens-esthe-progress-{timestamp}.md"
    filepath = os.path.join(obsidian_dir, filename)
    os.makedirs(obsidian_dir, exist_ok=True)

    completed = re.findall(r"✅\s*(.+)", p_content)
    pending = re.findall(r"⬜\s*(.+)", p_content)
    total = len(completed) + len(pending)
    pct = round(len(completed) / total * 100, 1) if total > 0 else 0

    md = f"""---
project: mens-esthe-kuchikomi
type: progress-summary
date: {now.strftime("%Y-%m-%d")}
time: {now.strftime("%H:%M")}
tags: [agent, progress, auto-generated, mens-esthe]
---
# 進捗サマリー

> 自動生成日時: {now.strftime("%Y-%m-%d %H:%M")}
> プロジェクト: [[mens-esthe-kuchikomi]]
> ソース: [[PROGRESS.md]]

## ✅ 完了タスク（{len(completed)}件）
{chr(10).join(f'- {c.strip()}' for c in completed[:30])}

## ⬜ 未完了タスク（{len(pending)}件）
{chr(10).join(f'- {p.strip()}' for p in pending[:30])}

## 統計
- 進捗率: {pct}%
- 総タスク数: {total}

---
*自動生成: Agent Foundation Server (Port 3333)*
*最終更新: {now.strftime("%Y-%m-%d %H:%M")}*
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md)

    return {
        "success": True,
        "file": filename,
        "path": filepath,
        "stats": {"completed": len(completed), "pending": len(pending)},
    }


def get_export_history(obsidian_dir: str) -> list:
    if not os.path.exists(obsidian_dir):
        return []
    files = sorted(
        [f for f in os.listdir(obsidian_dir) if f.endswith(".md")],
        reverse=True,
    )
    return files[:20]
