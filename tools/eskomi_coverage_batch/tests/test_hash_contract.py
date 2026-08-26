import json
import unittest
from pathlib import Path

from tools.eskomi_coverage_batch.hash_contract import (
    canonical_current_json,
    canonical_json,
    current_hash,
    payload_hash,
)


FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "tests"
    / "fixtures"
    / "coverage-batch-hash-golden.json"
)


class HashContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_current_hash_cases_match_literal_golden_values(self):
        for case in self.fixture["current_hash_cases"]:
            with self.subTest(case=case["name"]):
                self.assertEqual(
                    case["canonical"],
                    canonical_current_json(
                        case["field"], case["exists"], case["value"]
                    ),
                )
                self.assertEqual(
                    case["sha256"],
                    current_hash(case["field"], case["exists"], case["value"]),
                )

    def test_payload_hash_preserves_list_order_and_sorts_object_keys(self):
        for case in self.fixture["payload_hash_cases"]:
            with self.subTest(case=case["name"]):
                self.assertEqual(case["canonical"], canonical_json(case["payload"]))
                self.assertEqual(case["sha256"], payload_hash(case["payload"]))

    def test_invalid_basic_price_values_are_rejected_before_hashing(self):
        for case in self.fixture["invalid_current_hash_cases"]:
            with self.subTest(case=case["name"]):
                with self.assertRaises(ValueError):
                    current_hash(case["field"], case["exists"], case["value"])

    def test_text_fields_reject_non_string_values(self):
        for value in (None, True, 13000, 13.5, ["大阪"], {"city": "大阪"}):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    current_hash("shop_address", True, value)


if __name__ == "__main__":
    unittest.main()
