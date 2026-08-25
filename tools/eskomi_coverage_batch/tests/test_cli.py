import json
import tempfile
import unittest
from pathlib import Path

from tools.eskomi_coverage_batch.cli import main
from tools.eskomi_coverage_batch.compiler import compile_batch
from tools.eskomi_coverage_batch.wordpress_snapshot import ShopSnapshot, WordPressSnapshot


MAP_DIR = Path("/Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_WP_MAP_2026-08-24")
ACTIONS = MAP_DIR / "ESKOMI_COVERAGE_FIRST_WP_ACTIONS_2026-08-24.csv"
PROPOSED = MAP_DIR / "ESKOMI_COVERAGE_FIRST_CURRENT_PROPOSED_2026-08-24.csv"
W3_FINAL = Path("/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_FINAL_DATASET_2026-08-23.csv")
W3_PROPOSED = Path("/Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_WP_PROPOSED_V3_2026-08-23.csv")


class CliTest(unittest.TestCase):
    def test_main_compiles_fetches_and_writes_manifest_plus_five_artifacts(self):
        batch = compile_batch(ACTIONS, PROPOSED, (W3_FINAL, W3_PROPOSED))
        shops = tuple(
            ShopSnapshot(
                operation.wp_id,
                operation.wp_slug,
                "publish",
                operation.canonical_name,
                operation.area_terms if operation.action != "ADD_AREA_RELATION" else (),
                {field.field: field.current_value for field in operation.fields},
            )
            for operation in batch.operations
            if operation.wp_id is not None
        )

        def fetcher(base_url, timeout, retries):
            self.assertEqual("https://mens-esthe-kuchikomi.com", base_url)
            self.assertEqual(3, retries)
            return WordPressSnapshot(
                base_url,
                "2026-08-26T00:00:00+00:00",
                {13: "shinosaka", 17: "sakai"},
                shops,
            )

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "manifest.json"
            output = root / "outputs"
            status = main(
                [
                    "--actions", str(ACTIONS),
                    "--proposed", str(PROPOSED),
                    "--w3-final", str(W3_FINAL),
                    "--w3-proposed", str(W3_PROPOSED),
                    "--manifest", str(manifest),
                    "--output-dir", str(output),
                ],
                snapshot_fetcher=fetcher,
            )
            self.assertEqual(0, status)
            self.assertEqual(28, len(json.loads(manifest.read_text())["operations"]))
            self.assertEqual(5, len(tuple(output.iterdir())))


if __name__ == "__main__":
    unittest.main()
