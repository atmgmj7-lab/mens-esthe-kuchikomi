import os
import json
from datetime import datetime

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "..", "memory_store.json")


def _load() -> list:
    if not os.path.exists(MEMORY_FILE):
        return []
    with open(MEMORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(memories: list) -> None:
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memories, f, ensure_ascii=False, indent=2)


def get_memories() -> list:
    return _load()


def save_memory(data: dict) -> dict:
    memories = _load()
    m = {
        "id": len(memories) + 1,
        "title": data.get("title", ""),
        "content": data.get("content", ""),
        "date": datetime.now().isoformat(),
        "tags": data.get("tags", []),
    }
    memories.append(m)
    _save(memories)
    return {"success": True, "memory": m}


def delete_memory(mid: int) -> dict:
    memories = _load()
    memories = [m for m in memories if m["id"] != mid]
    _save(memories)
    return {"success": True}
