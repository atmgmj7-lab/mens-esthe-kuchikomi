import json
import os
import tempfile
import unittest
from pathlib import Path

from tools.eskomi_coverage_batch.artifacts import (
    REQUIRED_FILENAMES,
    safe_csv_cell,
    write_handoff_artifacts,
    write_manifest,
)
from tools.eskomi_coverage_batch.compiler import compile_batch
from tools.eskomi_coverage_batch.dryrun import dry_run
from tools.eskomi_coverage_batch.wordpress_snapshot import ShopSnapshot, WordPressSnapshot


MAP_DIR = Path("/Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_WP_MAP_2026-08-24")
ACTIONS = MAP_DIR / "ESKOMI_COVERAGE_FIRST_WP_ACTIONS_2026-08-24.csv"
PROPOSED = MAP_DIR / "ESKOMI_COVERAGE_FIRST_CURRENT_PROPOSED_2026-08-24.csv"
W3 = (
    Path("/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_FINAL_DATASET_2026-08-23.csv"),
    Path("/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_WP_PROPOSED_V3_2026-08-23.csv"),
)


class ArtifactTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.batch = compile_batch(ACTIONS, PROPOSED, W3)
        shops = []
        for operation in cls.batch.operations:
            if operation.wp_id is None:
                continue
            shops.append(
                ShopSnapshot(
                    id=operation.wp_id,
                    slug=operation.wp_slug,
                    status="publish",
                    title=operation.canonical_name,
                    area_terms=operation.area_terms
                    if operation.action != "ADD_AREA_RELATION"
                    else (),
                    fields={field.field: field.current_value for field in operation.fields},
                )
            )
        cls.snapshot = WordPressSnapshot(
            base_url="https://mens-esthe-kuchikomi.com",
            fetched_at="2026-08-26T00:00:00+00:00",
            areas={13: "shinosaka", 17: "sakai"},
            shops=tuple(shops),
        )
        cls.result = dry_run(cls.batch, cls.snapshot)

    def test_csv_formula_prefixes_are_escaped(self):
        for value in ("=cmd", "+1", "-2", "@SUM(A1)"):
            self.assertEqual("'" + value, safe_csv_cell(value))
        self.assertEqual("normal", safe_csv_cell("normal"))

    def test_manifest_is_deterministic_private_and_has_apply_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.json"
            second = Path(directory) / "second.json"
            write_manifest(self.batch, self.result, first)
            write_manifest(self.batch, self.result, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(0o600, os.stat(first).st_mode & 0o777)
            value = json.loads(first.read_text(encoding="utf-8"))
            self.assertEqual(30, value["candidate_row_count"])
            self.assertEqual(28, value["execution_entity_count"])
            self.assertEqual(28, len(value["operations"]))
            self.assertTrue(all(len(item["payload_hash"]) == 64 for item in value["operations"]))
            m0145 = next(item for item in value["operations"] if item["master_shop_id"] == "M0145")
            self.assertEqual([13, 17], m0145["payload"]["area_terms"])
            self.assertEqual("draft_then_readback_then_publish", m0145["create_lifecycle"])

    def test_missing_public_wp_entity_is_recorded_as_hold_without_write_fields(self):
        result = dry_run(
            self.batch,
            WordPressSnapshot(
                base_url="https://mens-esthe-kuchikomi.com",
                fetched_at="2026-08-26T00:00:00+00:00",
                areas={13: "shinosaka", 17: "sakai"},
                shops=(),
            ),
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            write_manifest(self.batch, result, path)
            value = json.loads(path.read_text(encoding="utf-8"))
            held_update = next(
                item
                for item in value["operations"]
                if item["action"] == "UPDATE_EXISTING"
            )
            self.assertEqual("HOLD", held_update["dry_run_status"])
            self.assertEqual([], held_update["payload"]["fields"])

    def test_writes_exactly_five_required_handoff_files(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            write_handoff_artifacts(self.batch, self.result, output)
            self.assertEqual(set(REQUIRED_FILENAMES), {path.name for path in output.iterdir()})

    def test_pilot_legacy_file_records_nine_operations_and_ten_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            write_handoff_artifacts(self.batch, self.result, output)
            pilot = json.loads(
                (output / "ESKOMI_COVERAGE_PILOT_8_PAYLOAD_2026-08-25.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(8, pilot["original_pilot_operations"])
            self.assertEqual(["M0145"], pilot["added_pilot_operations"])
            self.assertEqual(9, pilot["pilot_operation_count"])
            self.assertEqual(10, pilot["pilot_candidate_area_row_count"])
            self.assertEqual(9, len(pilot["operations"]))

    def test_remainder_and_rollback_cover_all_nonpilot_entities(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            write_handoff_artifacts(self.batch, self.result, output)
            remainder = (
                output / "ESKOMI_COVERAGE_BATCH_REMAINDER_2026-08-25.csv"
            ).read_text(encoding="utf-8")
            self.assertEqual(21, len(remainder.splitlines()))
            report = (
                output / "ESKOMI_COVERAGE_BATCH_PREP_REPORT_2026-08-25.md"
            ).read_text(encoding="utf-8")
            self.assertIn("Remainder execution entities: 19", report)
            self.assertIn("Remainder candidate-area rows: 20", report)
            rollback = (
                output / "ESKOMI_COVERAGE_ROLLBACK_PLAN_2026-08-25.md"
            ).read_text(encoding="utf-8")
            self.assertIn("UPDATE_EXISTING", rollback)
            self.assertIn("ADD_AREA_RELATION", rollback)
            self.assertIn("CREATE_NEW", rollback)
            self.assertIn("draft", rollback.lower())
            self.assertNotIn("hard delete", rollback.lower())

    def test_artifacts_do_not_contain_secret_material(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            write_handoff_artifacts(self.batch, self.result, output)
            combined = "\n".join(path.read_text(encoding="utf-8") for path in output.iterdir())
            for forbidden in (
                "Authorization:",
                "BEGIN PRIVATE KEY",
                "service_role",
                "application_password",
            ):
                self.assertNotIn(forbidden, combined)


if __name__ == "__main__":
    unittest.main()
