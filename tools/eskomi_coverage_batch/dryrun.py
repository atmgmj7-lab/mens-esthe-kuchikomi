"""Pure dry-run classification for the fixed coverage batch."""

import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Tuple
from urllib.parse import urlsplit, urlunsplit

from .hash_contract import current_hash
from .models import BatchManifest, BatchOperation, FieldProposal
from .wordpress_snapshot import AREA_CONTRACT, ShopSnapshot, WordPressSnapshot


@dataclass(frozen=True)
class FieldResult:
    field: str
    status: str
    current_value: Any
    proposed_value: Any
    expected_current_value: Any
    current_hash: str
    source: str
    observed_at: str


@dataclass(frozen=True)
class EntityResult:
    operation_id: str
    master_shop_id: str
    action: str
    wp_id: Any
    status: str
    field_results: Tuple[FieldResult, ...]
    area_terms_to_add: Tuple[int, ...]
    collisions: Tuple[str, ...]
    payload_hash: str


@dataclass(frozen=True)
class DryRunResult:
    batch_id: str
    status: str
    candidate_row_count: int
    entity_results: Tuple[EntityResult, ...]
    duplicate_shop_count: int
    duplicate_relation_count: int
    double_update_count: int
    snapshot_fetched_at: str


def _normalized_text(value: Any) -> str:
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).split()).casefold()


def _normalized_url(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    parts = urlsplit(raw)
    path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.casefold(), parts.netloc.casefold(), path, parts.query, ""))


def _normalized_tel(value: Any) -> str:
    return re.sub(r"\D", "", unicodedata.normalize("NFKC", str(value or "")))


def _equivalent(field: str, left: Any, right: Any) -> bool:
    if field == "basic_price":
        return str(left if left is not None else "") == str(
            right if right is not None else ""
        )
    if field == "shop_address":
        return _normalized_text(left) == _normalized_text(right)
    if field == "official_url":
        return _normalized_url(left) == _normalized_url(right)
    if field == "shop_tel":
        return _normalized_tel(left) == _normalized_tel(right)
    return left == right


def _field_result(proposal: FieldProposal, shop: ShopSnapshot) -> FieldResult:
    exists = proposal.field in shop.fields
    actual = shop.fields.get(proposal.field)
    if _equivalent(proposal.field, actual, proposal.proposed_value):
        status = "NO_CHANGE"
    elif proposal.proposed_value == "":
        status = "DEFERRED_FIELD"
    elif not _equivalent(proposal.field, actual, proposal.current_value):
        status = "CONFLICT"
    else:
        status = "READY_UPDATE"
    return FieldResult(
        field=proposal.field,
        status=status,
        current_value=actual,
        proposed_value=proposal.proposed_value,
        expected_current_value=proposal.current_value,
        current_hash=current_hash(proposal.field, exists, actual),
        source=proposal.source,
        observed_at=proposal.observed_at,
    )


def _create_collisions(operation: BatchOperation, shops: Tuple[ShopSnapshot, ...]):
    values = {proposal.field: proposal.proposed_value for proposal in operation.fields}
    wanted_url = _normalized_url(values.get("official_url"))
    wanted_tel = _normalized_tel(values.get("shop_tel"))
    wanted_address = _normalized_text(values.get("shop_address"))
    wanted_title = _normalized_text(operation.canonical_name)
    wanted_slug = operation.wp_slug.casefold()
    collisions = set()
    for shop in shops:
        if wanted_url and _normalized_url(shop.fields.get("official_url")) == wanted_url:
            collisions.add("official_url")
        if wanted_tel and _normalized_tel(shop.fields.get("shop_tel")) == wanted_tel:
            collisions.add("shop_tel")
        if wanted_address and _normalized_text(shop.fields.get("shop_address")) == wanted_address:
            collisions.add("shop_address")
        if wanted_title and _normalized_text(shop.title) == wanted_title:
            collisions.add("canonical_name")
        if wanted_slug and shop.slug.casefold() == wanted_slug:
            collisions.add("slug")
    return tuple(sorted(collisions))


def _hold(operation: BatchOperation) -> EntityResult:
    return EntityResult(
        operation.operation_id,
        operation.master_shop_id,
        operation.action,
        operation.wp_id,
        "HOLD",
        (),
        (),
        (),
        operation.payload_hash,
    )


def _classify(operation: BatchOperation, snapshot: WordPressSnapshot) -> EntityResult:
    shops_by_id = snapshot.shops_by_id
    if operation.action == "CREATE_NEW":
        collisions = _create_collisions(operation, snapshot.shops)
        if not operation.location_evidence:
            collisions = tuple(sorted((*collisions, "physical_location_evidence_missing")))
        return EntityResult(
            operation.operation_id,
            operation.master_shop_id,
            operation.action,
            None,
            "HOLD" if collisions else "READY_CREATE",
            (),
            (),
            collisions,
            operation.payload_hash,
        )

    shop = shops_by_id.get(operation.wp_id)
    if shop is None:
        return _hold(operation)
    if operation.action == "ADD_AREA_RELATION":
        to_add = tuple(term for term in operation.area_terms if term not in shop.area_terms)
        return EntityResult(
            operation.operation_id,
            operation.master_shop_id,
            operation.action,
            operation.wp_id,
            "READY_RELATION" if to_add else "NO_CHANGE",
            (),
            to_add,
            (),
            operation.payload_hash,
        )

    results = tuple(_field_result(proposal, shop) for proposal in operation.fields)
    statuses = {result.status for result in results}
    if "CONFLICT" in statuses:
        status = "CONFLICT"
    elif "READY_UPDATE" in statuses:
        status = "READY_UPDATE"
    elif statuses == {"DEFERRED_FIELD"}:
        status = "HOLD"
    else:
        status = "NO_CHANGE"
    return EntityResult(
        operation.operation_id,
        operation.master_shop_id,
        operation.action,
        operation.wp_id,
        status,
        results,
        (),
        (),
        operation.payload_hash,
    )


def _duplicate_metrics(operations: Tuple[BatchOperation, ...]):
    create_keys = []
    relation_keys = []
    update_keys = []
    for operation in operations:
        if operation.action == "CREATE_NEW":
            create_keys.append(operation.master_shop_id)
        elif operation.action == "ADD_AREA_RELATION":
            relation_keys.extend((operation.wp_id, term) for term in operation.area_terms)
        elif operation.action == "UPDATE_EXISTING":
            update_keys.extend((operation.wp_id, field.field) for field in operation.fields)
    duplicates = lambda values: len(values) - len(set(values))
    return duplicates(create_keys), duplicates(relation_keys), duplicates(update_keys)


def dry_run(manifest: BatchManifest, snapshot: WordPressSnapshot) -> DryRunResult:
    area_ok = dict(snapshot.areas) == AREA_CONTRACT
    entities = tuple(
        _classify(operation, snapshot) if area_ok else _hold(operation)
        for operation in manifest.operations
    )
    duplicate_shops, duplicate_relations, double_updates = _duplicate_metrics(
        manifest.operations
    )
    return DryRunResult(
        batch_id=manifest.batch_id,
        status="COMPLETE" if area_ok else "AREA_CONTRACT_MISMATCH",
        candidate_row_count=len(manifest.candidate_rows),
        entity_results=entities,
        duplicate_shop_count=duplicate_shops,
        duplicate_relation_count=duplicate_relations,
        double_update_count=double_updates,
        snapshot_fetched_at=snapshot.fetched_at,
    )
