import json
import unittest
from pathlib import Path

from tools.eskomi_coverage_batch.hash_contract import (
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
                value = {
                    "field": case["field"],
                    "exists": case["exists"],
                    "value": case["value"],
                }
                self.assertEqual(case["canonical"], canonical_json(value))
                self.assertEqual(
                    case["sha256"],
                    current_hash(case["field"], case["exists"], case["value"]),
                )

    def test_payload_hash_preserves_list_order_and_sorts_object_keys(self):
        for case in self.fixture["payload_hash_cases"]:
            with self.subTest(case=case["name"]):
                self.assertEqual(case["canonical"], canonical_json(case["payload"]))
                self.assertEqual(case["sha256"], payload_hash(case["payload"]))


if __name__ == "__main__":
    unittest.main()
