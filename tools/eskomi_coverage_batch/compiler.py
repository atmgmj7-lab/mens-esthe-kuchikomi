"""Compile the approved mapping files into a fixed, deterministic batch."""

import csv
import hashlib
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from .hash_contract import payload_hash
from .models import (
    BatchManifest,
    BatchOperation,
    CandidateRow,
    FieldProposal,
    PhysicalLocationEvidence,
)


BATCH_ID = "coverage-first-2026-08-25"
AREA_TERMS = {"新大阪": 13, "堺東": 17}
ACTIONS = {"UPDATE_EXISTING", "CREATE_NEW", "ADD_AREA_RELATION"}
DIRECT_FIELDS = {
    "official_url",
    "shop_address",
    "basic_price",
    "shop_hours",
    "shop_tel",
    "shop_booking",
}
CONTROL_FIELDS = {"area_relation", "post_title"}
DEFERRED_FIELDS = {
    "shop_station",
    "shop_access",
    "shop_booking_url",
    "shop_line",
}
KNOWN_FIELDS = DIRECT_FIELDS | CONTROL_FIELDS | DEFERRED_FIELDS
PILOT_MASTERS = {
    "M0004",
    "M0118",
    "M0145",
    "M0209",
    "M0251",
    "M0501",
    "M0536",
    "M0653",
    "M0654",
}


class BatchCompileError(ValueError):
    pass


def _read_csv(path: Path) -> List[Dict[str, str]]:
    csv.field_size_limit(sys.maxsize)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _as_wp_id(value: str):
    return int(value) if value.strip() else None


def _proposal(row: Dict[str, str]) -> FieldProposal:
    return FieldProposal(
        field=row["field"],
        current_value=row["current_value"],
        proposed_value=row["proposed_value"],
        source=row["proposed_source"],
        observed_at=row["observedAt"],
        change_type=row["change_type"],
        evidence_status=row["evidence_status"],
    )


def _merge_proposals(rows: Iterable[CandidateRow], deferred: bool) -> Tuple[FieldProposal, ...]:
    by_field: Dict[str, FieldProposal] = {}
    allowed = DEFERRED_FIELDS if deferred else DIRECT_FIELDS
    for candidate in rows:
        for proposal in candidate.proposals:
            if proposal.field not in allowed:
                continue
            existing = by_field.get(proposal.field)
            if existing and existing != proposal:
                raise BatchCompileError(
                    f"inconsistent cross-area field for {candidate.master_shop_id}: {proposal.field}"
                )
            by_field[proposal.field] = proposal
    return tuple(by_field[field] for field in sorted(by_field))


def _build_operation(rows: Sequence[CandidateRow]) -> BatchOperation:
    first = rows[0]
    if any(row.action != first.action for row in rows):
        raise BatchCompileError(f"cross-area action mismatch: {first.master_shop_id}")
    if any(row.wp_id != first.wp_id for row in rows):
        raise BatchCompileError(f"cross-area WP ID mismatch: {first.master_shop_id}")
    if any(row.canonical_name != first.canonical_name for row in rows):
        raise BatchCompileError(f"cross-area identity mismatch: {first.master_shop_id}")

    fields = _merge_proposals(rows, deferred=False)
    deferred_fields = _merge_proposals(rows, deferred=True)
    changed = {
        proposal.field: proposal.proposed_value
        for proposal in fields
        if proposal.change_type != "NO_CHANGE" and proposal.proposed_value != ""
    }
    area_terms = tuple(sorted({row.area_term_id for row in rows}))
    location_evidence = tuple(
        row.location_evidence for row in rows if row.location_evidence is not None
    )
    payload = {
        "action": first.action,
        "area_terms": list(area_terms),
        "fields": changed,
        "master_shop_id": first.master_shop_id,
        "title": first.canonical_name,
    }
    action_token = {
        "UPDATE_EXISTING": "update",
        "CREATE_NEW": "create",
        "ADD_AREA_RELATION": "relation",
    }[first.action]
    return BatchOperation(
        operation_id=f"coverage-{first.master_shop_id.lower()}-{action_token}",
        master_shop_id=first.master_shop_id,
        canonical_name=first.canonical_name,
        action=first.action,
        wp_id=first.wp_id,
        wp_slug=first.wp_slug or f"eskomi-{first.master_shop_id.lower()}",
        area_terms=area_terms,
        fields=fields,
        deferred_fields=deferred_fields,
        location_evidence=location_evidence,
        payload_hash=payload_hash(payload),
    )


def compile_batch(
    actions_path: Path,
    proposed_path: Path,
    source_paths: Sequence[Path] = (),
) -> BatchManifest:
    actions_path = Path(actions_path)
    proposed_path = Path(proposed_path)
    all_sources = (actions_path, proposed_path, *(Path(path) for path in source_paths))
    if len(source_paths) < 1:
        raise BatchCompileError("W3 final dataset is required")
    action_rows = _read_csv(actions_path)
    basic_rows = [row for row in action_rows if row["BASIC_VERIFIED"] == "YES"]

    keys = [(row["target_area"], row["Master_ID"]) for row in basic_rows]
    if len(keys) != len(set(keys)):
        raise BatchCompileError("duplicate BASIC candidate area/Master_ID")
    area_counts = Counter(row["target_area"] for row in basic_rows)
    if area_counts != Counter({"新大阪": 20, "堺東": 10}):
        raise BatchCompileError(f"fixed BASIC scope mismatch: {dict(area_counts)}")
    for row in basic_rows:
        if row["proposed_action"] not in ACTIONS:
            raise BatchCompileError(f"unknown action: {row['proposed_action']}")
        if row["target_area"] not in AREA_TERMS:
            raise BatchCompileError(f"unknown target area: {row['target_area']}")

    wanted = set(keys)
    w3_by_key = {}
    for row in _read_csv(Path(source_paths[0])):
        key = (row["area_target"], row["Master_ID"])
        if key not in wanted:
            continue
        if key in w3_by_key:
            raise BatchCompileError(f"duplicate W3 candidate: {key}")
        w3_by_key[key] = row
    proposed_by_key: Dict[Tuple[str, str], List[FieldProposal]] = defaultdict(list)
    for row in _read_csv(proposed_path):
        key = (row["target_area"], row["Master_ID"])
        if key not in wanted:
            continue
        field = row["field"]
        if field not in KNOWN_FIELDS:
            raise BatchCompileError(f"unknown proposed field: {field}")
        if (
            field in DIRECT_FIELDS | {"post_title"}
            and row["proposed_value"]
            and not row["proposed_source"].startswith("https://")
        ):
            raise BatchCompileError(
                f"HTTPS source required for {row['Master_ID']} {field}"
            )
        proposed_by_key[key].append(_proposal(row))

    candidates = []
    for row in basic_rows:
        key = (row["target_area"], row["Master_ID"])
        if key not in proposed_by_key:
            raise BatchCompileError(f"missing proposals for {key}")
        w3 = w3_by_key.get(key)
        if w3 is None:
            raise BatchCompileError(f"missing W3 candidate for {key}")
        has_location = any(w3.get(name, "").strip() for name in ("address", "station", "access"))
        location_evidence = None
        if has_location:
            if not w3["official_URL"].startswith("https://"):
                raise BatchCompileError(f"HTTPS source required for location evidence {key}")
            location_evidence = PhysicalLocationEvidence(
                target_area=row["target_area"],
                final_area_class=w3["final_area_class"],
                address=w3["address"],
                station=w3["station"],
                access=w3["access"],
                source=w3["official_URL"],
                observed_at=w3["official_observedAt"],
            )
        candidates.append(
            CandidateRow(
                target_area=row["target_area"],
                master_shop_id=row["Master_ID"],
                canonical_name=row["canonical_name"],
                final_area_class=row["final_area_class"],
                wp_id=_as_wp_id(row["WP_ID"]),
                wp_slug=row["WP_slug"],
                mapping_status=row["mapping_status"],
                action=row["proposed_action"],
                basic_verified=True,
                area_term_id=AREA_TERMS[row["target_area"]],
                proposals=tuple(
                    sorted(proposed_by_key[key], key=lambda proposal: proposal.field)
                ),
                location_evidence=location_evidence,
            )
        )

    grouped: Dict[str, List[CandidateRow]] = defaultdict(list)
    for candidate in candidates:
        grouped[candidate.master_shop_id].append(candidate)
    operations = tuple(
        _build_operation(grouped[master_shop_id]) for master_shop_id in sorted(grouped)
    )
    if len(operations) != 28:
        raise BatchCompileError(f"execution entity count mismatch: {len(operations)}")

    pilot_ids = tuple(
        operation.operation_id
        for operation in operations
        if operation.master_shop_id in PILOT_MASTERS
    )
    if len(pilot_ids) != 9:
        raise BatchCompileError(f"pilot operation count mismatch: {len(pilot_ids)}")

    source_hashes = {path.name: _file_hash(path) for path in all_sources}
    if len(source_hashes) != len(all_sources):
        raise BatchCompileError("source filenames must be unique")
    return BatchManifest(
        batch_id=BATCH_ID,
        candidate_rows=tuple(candidates),
        operations=operations,
        pilot_operation_ids=pilot_ids,
        source_hashes=source_hashes,
    )
