import unittest
from pathlib import Path

from tools.eskomi_coverage_batch.compiler import compile_batch
from tools.eskomi_coverage_batch.dryrun import dry_run
from tools.eskomi_coverage_batch.models import (
    BatchManifest,
    BatchOperation,
    FieldProposal,
)
from tools.eskomi_coverage_batch.wordpress_snapshot import (
    ShopSnapshot,
    WordPressSnapshot,
)


MAP_DIR = Path("/Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_WP_MAP_2026-08-24")
ACTIONS = MAP_DIR / "ESKOMI_COVERAGE_FIRST_WP_ACTIONS_2026-08-24.csv"
PROPOSED = MAP_DIR / "ESKOMI_COVERAGE_FIRST_CURRENT_PROPOSED_2026-08-24.csv"
W3 = (
    Path("/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_FINAL_DATASET_2026-08-23.csv"),
    Path("/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_WP_PROPOSED_V3_2026-08-23.csv"),
)


def field(name, current, proposed, change="UPDATE"):
    return FieldProposal(
        field=name,
        current_value=current,
        proposed_value=proposed,
        source="https://example.test/source",
        observed_at="2026-08-23T00:00:00+00:00",
        change_type=change,
        evidence_status="OFFICIAL_FACT",
    )


def operation(action, fields=(), wp_id=10, area_terms=(13,), title="Test Shop", slug="test-shop"):
    return BatchOperation(
        operation_id="coverage-mtest-op",
        master_shop_id="MTEST",
        canonical_name=title,
        action=action,
        wp_id=wp_id,
        wp_slug=slug,
        area_terms=area_terms,
        fields=tuple(fields),
        deferred_fields=(),
        payload_hash="a" * 64,
    )


def manifest(op):
    return BatchManifest(
        batch_id="test-batch",
        candidate_rows=(),
        operations=(op,),
        pilot_operation_ids=(),
        source_hashes={},
    )


class DryRunTest(unittest.TestCase):
    def snapshot(self, shops=(), areas=None):
        return WordPressSnapshot(
            base_url="https://example.test",
            fetched_at="2026-08-26T00:00:00+00:00",
            areas=areas or {13: "shinosaka", 17: "sakai"},
            shops=tuple(shops),
        )

    def test_exact_area_id_slug_contract_is_required(self):
        op = operation("ADD_AREA_RELATION")
        result = dry_run(manifest(op), self.snapshot(areas={13: "sakai", 17: "shinosaka"}))
        self.assertEqual("AREA_CONTRACT_MISMATCH", result.status)
        self.assertEqual("HOLD", result.entity_results[0].status)

    def test_update_detects_only_the_field_changed_since_mapping(self):
        op = operation(
            "UPDATE_EXISTING",
            fields=(
                field("basic_price", "13000", "10000"),
                field("shop_hours", "10:00", "11:00"),
            ),
        )
        shop = ShopSnapshot(
            id=10,
            slug="test-shop",
            status="publish",
            title="Test Shop",
            area_terms=(13,),
            fields={"basic_price": "15000", "shop_hours": "10:00"},
        )
        result = dry_run(manifest(op), self.snapshot((shop,)))
        entity = result.entity_results[0]
        self.assertEqual("CONFLICT", entity.status)
        self.assertEqual(
            {"basic_price": "CONFLICT", "shop_hours": "READY_UPDATE"},
            {item.field: item.status for item in entity.field_results},
        )

    def test_equal_values_are_no_change_and_not_sent(self):
        op = operation("UPDATE_EXISTING", fields=(field("shop_tel", "0901", "0901", "NO_CHANGE"),))
        shop = ShopSnapshot(10, "test-shop", "publish", "Test Shop", (13,), {"shop_tel": "0901"})
        entity = dry_run(manifest(op), self.snapshot((shop,))).entity_results[0]
        self.assertEqual("NO_CHANGE", entity.status)
        self.assertEqual("NO_CHANGE", entity.field_results[0].status)

    def test_public_rest_serialization_differences_do_not_create_false_conflicts(self):
        op = operation(
            "UPDATE_EXISTING",
            fields=(
                field("basic_price", "13000", "10000"),
                field("shop_address", "新大阪 / JR新大阪駅", "大阪市淀川区1"),
            ),
        )
        shop = ShopSnapshot(
            10,
            "test-shop",
            "publish",
            "Test Shop",
            (13,),
            {"basic_price": 13000, "shop_address": "新大阪\u00a0/\u00a0JR新大阪駅"},
        )
        entity = dry_run(manifest(op), self.snapshot((shop,))).entity_results[0]
        self.assertEqual("READY_UPDATE", entity.status)
        self.assertEqual(
            {"basic_price": "READY_UPDATE", "shop_address": "READY_UPDATE"},
            {item.field: item.status for item in entity.field_results},
        )

    def test_existing_relation_is_no_change(self):
        op = operation("ADD_AREA_RELATION", fields=(), area_terms=(13, 17))
        shop = ShopSnapshot(10, "test-shop", "publish", "Test Shop", (13, 17), {})
        entity = dry_run(manifest(op), self.snapshot((shop,))).entity_results[0]
        self.assertEqual("NO_CHANGE", entity.status)

    def test_missing_relation_is_ready_without_primary_area_change(self):
        op = operation("ADD_AREA_RELATION", fields=(), area_terms=(13, 17))
        shop = ShopSnapshot(10, "test-shop", "publish", "Test Shop", (17,), {})
        entity = dry_run(manifest(op), self.snapshot((shop,))).entity_results[0]
        self.assertEqual("READY_RELATION", entity.status)
        self.assertEqual((13,), entity.area_terms_to_add)

    def test_create_holds_on_each_identity_collision_class(self):
        create = operation(
            "CREATE_NEW",
            fields=(
                field("official_url", "", "https://new.example/", "CREATE_FIELD"),
                field("shop_tel", "", "090-1111-2222", "CREATE_FIELD"),
                field("shop_address", "", "大阪市淀川区1", "CREATE_FIELD"),
            ),
            wp_id=None,
            title="New Shop",
            slug="new-shop",
        )
        cases = {
            "official_url": ShopSnapshot(1, "other", "publish", "Other", (), {"official_url": "https://new.example"}),
            "shop_tel": ShopSnapshot(2, "other", "draft", "Other", (), {"shop_tel": "09011112222"}),
            "shop_address": ShopSnapshot(3, "other", "private", "Other", (), {"shop_address": "大阪市淀川区1"}),
            "canonical_name": ShopSnapshot(4, "other", "trash", "New Shop", (), {}),
            "slug": ShopSnapshot(5, "new-shop", "pending", "Other", (), {}),
        }
        for collision, shop in cases.items():
            with self.subTest(collision=collision):
                entity = dry_run(manifest(create), self.snapshot((shop,))).entity_results[0]
                self.assertEqual("HOLD", entity.status)
                self.assertIn(collision, entity.collisions)

    def test_create_without_collision_is_ready(self):
        create = operation(
            "CREATE_NEW",
            fields=(field("official_url", "", "https://new.example/", "CREATE_FIELD"),),
            wp_id=None,
            title="New Shop",
            slug="new-shop",
        )
        entity = dry_run(manifest(create), self.snapshot()).entity_results[0]
        self.assertEqual("READY_CREATE", entity.status)

    def test_real_batch_dry_run_is_complete_and_deterministic(self):
        batch = compile_batch(ACTIONS, PROPOSED, W3)
        shops = []
        for op in batch.operations:
            if op.wp_id is None:
                continue
            shops.append(
                ShopSnapshot(
                    id=op.wp_id,
                    slug=op.wp_slug,
                    status="publish",
                    title=op.canonical_name,
                    area_terms=op.area_terms if op.action != "ADD_AREA_RELATION" else (),
                    fields={proposal.field: proposal.current_value for proposal in op.fields},
                )
            )
        snapshot = self.snapshot(shops)
        first = dry_run(batch, snapshot)
        second = dry_run(batch, snapshot)
        self.assertEqual(30, first.candidate_row_count)
        self.assertEqual(28, len(first.entity_results))
        self.assertEqual(first, second)
        self.assertEqual(0, first.duplicate_shop_count)
        self.assertEqual(0, first.duplicate_relation_count)
        self.assertEqual(0, first.double_update_count)


if __name__ == "__main__":
    unittest.main()
