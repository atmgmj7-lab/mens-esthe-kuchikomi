"""Cross-language canonical JSON and SHA-256 contract."""

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def current_hash(field: str, exists: bool, value: Any) -> str:
    canonical = canonical_json({"field": field, "exists": exists, "value": value})
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def payload_hash(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
