"""Deterministic manifest and handoff artifact writers."""

import csv
import json
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping

from .dryrun import DryRunResult, EntityResult
from .hash_contract import payload_hash
from .models import BatchManifest, BatchOperation, CandidateRow


DRYRUN_NAME = "ESKOMI_COVERAGE_BATCH_DRYRUN_2026-08-25.csv"
PILOT_NAME = "ESKOMI_COVERAGE_PILOT_8_PAYLOAD_2026-08-25.json"
REMAINDER_NAME = "ESKOMI_COVERAGE_BATCH_REMAINDER_2026-08-25.csv"
ROLLBACK_NAME = "ESKOMI_COVERAGE_ROLLBACK_PLAN_2026-08-25.md"
REPORT_NAME = "ESKOMI_COVERAGE_BATCH_PREP_REPORT_2026-08-25.md"
REQUIRED_FILENAMES = (
    DRYRUN_NAME,
    PILOT_NAME,
    REMAINDER_NAME,
    ROLLBACK_NAME,
    REPORT_NAME,
)


def safe_csv_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def _atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def _atomic_text(path: Path, content: str) -> None:
    _atomic_bytes(path, content.encode("utf-8"))


def _json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")


def _changed_fields(operation: BatchOperation, entity: EntityResult):
    results = {item.field: item for item in entity.field_results}
    fields = []
    for proposal in operation.fields:
        if operation.action == "UPDATE_EXISTING":
            result = results.get(proposal.field)
            if result is None or result.status != "READY_UPDATE":
                continue
            fields.append(
                {
                    "field": proposal.field,
                    "current_hash": result.current_hash,
                    "proposed_value": proposal.proposed_value,
                    "source": proposal.source,
                    "observed_at": proposal.observed_at,
                }
            )
        elif operation.action == "CREATE_NEW" and proposal.proposed_value != "":
            fields.append(
                {
                    "field": proposal.field,
                    "proposed_value": proposal.proposed_value,
                    "source": proposal.source,
                    "observed_at": proposal.observed_at,
                }
            )
    return fields


def operation_record(operation: BatchOperation, entity: EntityResult) -> Dict[str, Any]:
    payload = {
        "action": operation.action,
        "area_terms": list(operation.area_terms),
        "fields": _changed_fields(operation, entity),
        "master_shop_id": operation.master_shop_id,
        "slug": operation.wp_slug,
        "title": operation.canonical_name,
        "wp_id": operation.wp_id,
    }
    if operation.action == "ADD_AREA_RELATION":
        payload["area_terms_to_add"] = list(entity.area_terms_to_add)
    return {
        "operation_id": operation.operation_id,
        "master_shop_id": operation.master_shop_id,
        "action": operation.action,
        "wp_id": operation.wp_id,
        "dry_run_status": entity.status,
        "payload": payload,
        "payload_hash": payload_hash(payload),
        "create_lifecycle": (
            "draft_then_readback_then_publish"
            if operation.action == "CREATE_NEW"
            else None
        ),
        "deferred_evidence": [
            {
                "field": item.field,
                "proposed_value": item.proposed_value,
                "source": item.source,
                "observed_at": item.observed_at,
            }
            for item in operation.deferred_fields
        ],
    }


def manifest_value(batch: BatchManifest, result: DryRunResult) -> Dict[str, Any]:
    entities = {item.operation_id: item for item in result.entity_results}
    records = [operation_record(item, entities[item.operation_id]) for item in batch.operations]
    return {
        "schema_version": 1,
        "batch_id": batch.batch_id,
        "mode": "DRY_RUN_ONLY",
        "area_contract": {"13": "shinosaka", "17": "sakai"},
        "source_hashes": batch.source_hashes,
        "snapshot_fetched_at": result.snapshot_fetched_at,
        "candidate_row_count": len(batch.candidate_rows),
        "execution_entity_count": len(batch.operations),
        "pilot_operation_ids": list(batch.pilot_operation_ids),
        "operations": records,
    }


def write_manifest(batch: BatchManifest, result: DryRunResult, path: Path) -> None:
    _atomic_bytes(Path(path), _json_bytes(manifest_value(batch, result)))


def _csv_text(headers, rows) -> str:
    from io import StringIO

    output = StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({name: safe_csv_cell(row.get(name, "")) for name in headers})
    return output.getvalue()


def _candidate_rows(batch: BatchManifest, result: DryRunResult, candidates):
    entities = {item.master_shop_id: item for item in result.entity_results}
    operations = {item.master_shop_id: item for item in batch.operations}
    for candidate in candidates:
        entity = entities[candidate.master_shop_id]
        operation = operations[candidate.master_shop_id]
        yield {
            "target_area": candidate.target_area,
            "Master_ID": candidate.master_shop_id,
            "canonical_name": candidate.canonical_name,
            "operation_id": operation.operation_id,
            "action": operation.action,
            "WP_ID": operation.wp_id,
            "WP_slug": operation.wp_slug,
            "area_term_id": candidate.area_term_id,
            "dry_run_status": entity.status,
            "field_statuses": " | ".join(
                f"{item.field}:{item.status}" for item in entity.field_results
            ),
            "area_terms_to_add": " | ".join(str(value) for value in entity.area_terms_to_add),
            "collisions": " | ".join(entity.collisions),
            "deferred_fields": " | ".join(item.field for item in operation.deferred_fields),
            "payload_hash": operation_record(operation, entity)["payload_hash"],
        }


CSV_HEADERS = (
    "target_area",
    "Master_ID",
    "canonical_name",
    "operation_id",
    "action",
    "WP_ID",
    "WP_slug",
    "area_term_id",
    "dry_run_status",
    "field_statuses",
    "area_terms_to_add",
    "collisions",
    "deferred_fields",
    "payload_hash",
)


def _rollback_plan() -> str:
    return """# Coverage Batch Rollback Plan

## Preconditions

- Rollback is available only for an operation with an owned ledger and audit snapshot.
- The current value/status/relation hash must still match the value written by that operation.
- A mismatch becomes `MANUAL_REVIEW_REQUIRED`; unrelated third-party changes are never overwritten.

## UPDATE_EXISTING

Restore only fields recorded in the before-snapshot, then read back every restored value. If one field fails, preserve the ledger and audit trail for manual review.

## ADD_AREA_RELATION

Remove only the area term recorded as added by this batch. Preserve every pre-existing relation and never change the primary-area field.

## CREATE_NEW

Return the created post to `draft` after verifying the ledger post ID and post-write hash. Do not permanently remove or archive the post. A retry reuses the same ledger-owned post ID.

## Cache

Cache revalidation is a separate retryable step. A cache retry never repeats the WordPress mutation.
"""


def _report(batch: BatchManifest, result: DryRunResult) -> str:
    counts = Counter(item.status for item in result.entity_results)
    pilot_masters = {item.master_shop_id for item in batch.pilot_operations}
    remainder_rows = [row for row in batch.candidate_rows if row.master_shop_id not in pilot_masters]
    remainder_operations = [item for item in batch.operations if item.master_shop_id not in pilot_masters]
    status_lines = "\n".join(f"- {key}: {counts[key]}" for key in sorted(counts))
    return f"""# Coverage First Batch Prep Report

## Scope and result

- Batch: `{batch.batch_id}`
- Mode: `DRY_RUN_ONLY`
- Candidate-area rows: {len(batch.candidate_rows)} / 30
- Execution entities: {len(batch.operations)} / 28
- Initial Pilot operations: {len(batch.pilot_operations)} (original 8 plus M0145)
- Initial Pilot candidate-area rows: {len(batch.pilot_candidate_rows)}
- Remainder execution entities: {len(remainder_operations)}
- Remainder candidate-area rows: {len(remainder_rows)}
- Area contract: `13=shinosaka`, `17=sakai`
- Duplicate shop candidates: {result.duplicate_shop_count}
- Duplicate relation candidates: {result.duplicate_relation_count}
- Double update candidates: {result.double_update_count}

## Dry-run entity classification

{status_lines}

## Revision requirements implemented

1. CREATE_NEW is `draft -> field/term write -> complete readback -> publish -> publish readback`.
2. M0145 is included in the initial Pilot after current public collision recheck.
3. Python and PHP consume one checked-in golden fixture for current and payload hashes.
4. Lock, ledger, private audit CPT, capability usermeta, and server-only write constant have explicit storage and lifecycle contracts.
5. Area term ID and slug pairs are checked before any apply path.

## Write boundary

This task performed public GET reads only. Production WordPress mutation, Supabase write, main push, and deployment were not performed. The checked-in writer remains disabled unless a future approved execution window explicitly enables it and grants its dedicated capability.
"""


def write_handoff_artifacts(
    batch: BatchManifest, result: DryRunResult, output_dir: Path
) -> None:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    pilot_ids = set(batch.pilot_operation_ids)
    pilot_masters = {item.master_shop_id for item in batch.pilot_operations}
    entities = {item.operation_id: item for item in result.entity_results}
    pilot_records = [
        operation_record(operation, entities[operation.operation_id])
        for operation in batch.operations
        if operation.operation_id in pilot_ids
    ]
    pilot = {
        "batch_id": batch.batch_id,
        "mode": "DRY_RUN_ONLY",
        "legacy_filename_note": "Filename retained from the original eight-operation pilot contract.",
        "original_pilot_operations": 8,
        "added_pilot_operations": ["M0145"],
        "pilot_operation_count": len(pilot_records),
        "pilot_candidate_area_row_count": len(batch.pilot_candidate_rows),
        "operations": pilot_records,
    }
    remainder_candidates = tuple(
        row for row in batch.candidate_rows if row.master_shop_id not in pilot_masters
    )
    _atomic_text(
        output / DRYRUN_NAME,
        _csv_text(CSV_HEADERS, _candidate_rows(batch, result, batch.candidate_rows)),
    )
    _atomic_bytes(output / PILOT_NAME, _json_bytes(pilot))
    _atomic_text(
        output / REMAINDER_NAME,
        _csv_text(CSV_HEADERS, _candidate_rows(batch, result, remainder_candidates)),
    )
    _atomic_text(output / ROLLBACK_NAME, _rollback_plan())
    _atomic_text(output / REPORT_NAME, _report(batch, result))
