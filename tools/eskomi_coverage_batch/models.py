"""Immutable values used by the fixed coverage batch compiler."""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple


@dataclass(frozen=True)
class FieldProposal:
    field: str
    current_value: str
    proposed_value: str
    source: str
    observed_at: str
    change_type: str
    evidence_status: str


@dataclass(frozen=True)
class PhysicalLocationEvidence:
    target_area: str
    final_area_class: str
    address: str
    station: str
    access: str
    source: str
    observed_at: str


@dataclass(frozen=True)
class CandidateRow:
    target_area: str
    master_shop_id: str
    canonical_name: str
    final_area_class: str
    wp_id: Optional[int]
    wp_slug: str
    mapping_status: str
    action: str
    basic_verified: bool
    area_term_id: int
    proposals: Tuple[FieldProposal, ...]
    location_evidence: Optional[PhysicalLocationEvidence] = None


@dataclass(frozen=True)
class BatchOperation:
    operation_id: str
    master_shop_id: str
    canonical_name: str
    action: str
    wp_id: Optional[int]
    wp_slug: str
    area_terms: Tuple[int, ...]
    fields: Tuple[FieldProposal, ...]
    deferred_fields: Tuple[FieldProposal, ...]
    payload_hash: str
    location_evidence: Tuple[PhysicalLocationEvidence, ...] = ()


@dataclass(frozen=True)
class BatchManifest:
    batch_id: str
    candidate_rows: Tuple[CandidateRow, ...]
    operations: Tuple[BatchOperation, ...]
    pilot_operation_ids: Tuple[str, ...]
    source_hashes: Dict[str, str]

    @property
    def pilot_operations(self) -> Tuple[BatchOperation, ...]:
        wanted = set(self.pilot_operation_ids)
        return tuple(operation for operation in self.operations if operation.operation_id in wanted)

    @property
    def pilot_candidate_rows(self) -> Tuple[CandidateRow, ...]:
        masters = {operation.master_shop_id for operation in self.pilot_operations}
        return tuple(row for row in self.candidate_rows if row.master_shop_id in masters)
