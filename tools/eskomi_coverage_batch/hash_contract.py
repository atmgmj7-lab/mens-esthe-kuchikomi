"""Cross-language canonical JSON and SHA-256 contract."""

import hashlib
import json
import re
from typing import Any


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def canonical_field_value(field: str, exists: bool, value: Any) -> Any:
    if not exists:
        if value is not None:
            raise ValueError("missing field value must be null")
        return None
    if field != "basic_price":
        if not isinstance(value, str):
            raise ValueError("text field value must be a string")
        return value
    if isinstance(value, bool):
        raise ValueError("basic_price must be a canonical positive integer")
    if isinstance(value, int):
        normalized = value
    elif isinstance(value, str) and re.fullmatch(r"[1-9][0-9]*", value):
        normalized = int(value)
    else:
        raise ValueError("basic_price must be a canonical positive integer")
    if not 1 <= normalized <= 1_000_000:
        raise ValueError("basic_price is outside the allowed range")
    return normalized


def canonical_current_json(field: str, exists: bool, value: Any) -> str:
    return canonical_json(
        {
            "field": field,
            "exists": exists,
            "value": canonical_field_value(field, exists, value),
        }
    )


def current_hash(field: str, exists: bool, value: Any) -> str:
    canonical = canonical_current_json(field, exists, value)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def payload_hash(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
