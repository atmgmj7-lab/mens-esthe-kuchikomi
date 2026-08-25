import csv
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from tools.eskomi_coverage_batch.compiler import BatchCompileError, compile_batch


MAP_DIR = Path("/Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_WP_MAP_2026-08-24")
ACTIONS = MAP_DIR / "ESKOMI_COVERAGE_FIRST_WP_ACTIONS_2026-08-24.csv"
PROPOSED = MAP_DIR / "ESKOMI_COVERAGE_FIRST_CURRENT_PROPOSED_2026-08-24.csv"
W3_FINAL = Path(
    "/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_FINAL_DATASET_2026-08-23.csv"
)
W3_PROPOSED = Path(
    "/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_WP_PROPOSED_V3_2026-08-23.csv"
)


class CompilerTest(unittest.TestCase):
    def compile(self, actions=ACTIONS, proposed=PROPOSED):
        return compile_batch(actions, proposed, (W3_FINAL, W3_PROPOSED))

    def rewrite_actions(self, mutate):
        with ACTIONS.open(encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            rows = list(reader)
            fieldnames = reader.fieldnames
        mutate(rows)
        handle = tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", suffix=".csv", delete=False
        )
        with handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return Path(handle.name)

    def rewrite_proposed(self, mutate):
        with PROPOSED.open(encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            rows = list(reader)
            fieldnames = reader.fieldnames
        mutate(rows)
        handle = tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", suffix=".csv", delete=False
        )
        with handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return Path(handle.name)

    def test_fixed_basic_scope_compiles_to_30_rows_and_28_entities(self):
        batch = self.compile()
        self.assertEqual(30, len(batch.candidate_rows))
        self.assertEqual(28, len(batch.operations))
        self.assertEqual(
            Counter({"新大阪": 20, "堺東": 10}),
            Counter(row.target_area for row in batch.candidate_rows),
        )
        self.assertTrue(all(row.basic_verified for row in batch.candidate_rows))

    def test_cross_area_entities_are_merged_without_losing_area_terms(self):
        batch = self.compile()
        by_master = {operation.master_shop_id: operation for operation in batch.operations}
        self.assertEqual("CREATE_NEW", by_master["M0145"].action)
        self.assertEqual((13, 17), by_master["M0145"].area_terms)
        self.assertIsNone(by_master["M0145"].wp_id)
        self.assertEqual("UPDATE_EXISTING", by_master["M0241"].action)
        self.assertEqual(683, by_master["M0241"].wp_id)
        self.assertEqual((13, 17), by_master["M0241"].area_terms)

    def test_initial_pilot_contains_m0145_and_original_eight(self):
        batch = self.compile()
        self.assertEqual(
            {
                "M0004",
                "M0118",
                "M0145",
                "M0209",
                "M0251",
                "M0501",
                "M0536",
                "M0653",
                "M0654",
            },
            {operation.master_shop_id for operation in batch.pilot_operations},
        )
        self.assertEqual(9, len(batch.pilot_operations))
        self.assertEqual(10, len(batch.pilot_candidate_rows))

    def test_source_hashes_cover_all_four_authoritative_inputs(self):
        batch = self.compile()
        self.assertEqual(4, len(batch.source_hashes))
        self.assertTrue(all(len(value) == 64 for value in batch.source_hashes.values()))

    def test_unknown_action_on_basic_row_is_rejected(self):
        def mutate(rows):
            next(row for row in rows if row["BASIC_VERIFIED"] == "YES")[
                "proposed_action"
            ] = "UPSERT_ANYTHING"

        path = self.rewrite_actions(mutate)
        self.addCleanup(path.unlink)
        with self.assertRaisesRegex(BatchCompileError, "unknown action"):
            self.compile(actions=path)

    def test_duplicate_area_master_key_is_rejected(self):
        def mutate(rows):
            rows.append(dict(next(row for row in rows if row["BASIC_VERIFIED"] == "YES")))

        path = self.rewrite_actions(mutate)
        self.addCleanup(path.unlink)
        with self.assertRaisesRegex(BatchCompileError, "duplicate BASIC candidate"):
            self.compile(actions=path)

    def test_unknown_proposed_field_for_basic_row_is_rejected(self):
        def mutate(rows):
            row = next(row for row in rows if row["Master_ID"] == "M0004")
            row["field"] = "arbitrary_meta"

        path = self.rewrite_proposed(mutate)
        self.addCleanup(path.unlink)
        with self.assertRaisesRegex(BatchCompileError, "unknown proposed field"):
            self.compile(proposed=path)

    def test_non_https_source_for_write_field_is_rejected(self):
        def mutate(rows):
            row = next(
                row
                for row in rows
                if row["Master_ID"] == "M0004" and row["field"] == "basic_price"
            )
            row["proposed_source"] = "http://example.invalid/system"

        path = self.rewrite_proposed(mutate)
        self.addCleanup(path.unlink)
        with self.assertRaisesRegex(BatchCompileError, "HTTPS source required"):
            self.compile(proposed=path)


if __name__ == "__main__":
    unittest.main()
