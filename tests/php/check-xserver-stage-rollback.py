"""Local-only contract tests for actual-stage Xserver rollback capture."""

from __future__ import annotations

import hashlib
import pathlib
import shutil
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GENERATE = ROOT / "scripts/generate-xserver-deploy-manifest.py"
CAPTURE = ROOT / "scripts/capture-xserver-rollback.sh"
ROLLBACK = ROOT / "scripts/xserver-rollback-from-snapshot.sh"
DEPLOYMENT_ID = "a" * 40 + "-123-1"


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, capture_output=True, text=True)
    if check and result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    return result


def write(path: pathlib.Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class StageRollback(unittest.TestCase):
    def layout(self, root: pathlib.Path, build_id: str):
        stage = root / "stage"
        site = root / "site"
        theme = site / "public_html/wp-content/themes/swell_child"
        rollback_root = site / "private/deploy-rollbacks"
        manifest = rollback_root / f".actual-deploy-manifest-{DEPLOYMENT_ID}.tsv"
        rollback_root.mkdir(parents=True)

        write(stage / "functions.php", "new functions\n")
        write(stage / "style.css", "new style\n")
        write(stage / "dashboard/index.html", "<h1>new dashboard</h1>\n")
        write(stage / f"dashboard/_next/static/{build_id}/_buildManifest.js", "new manifest\n")
        write(theme / "functions.php", "old functions\n")
        write(theme / "style.css", "old style\n")
        write(theme / "unlisted.txt", "preserve me\n")
        run("python3", str(GENERATE), str(stage), str(manifest))
        return stage, site, theme, rollback_root, manifest

    def capture(self, theme: pathlib.Path, rollback_root: pathlib.Path, manifest: pathlib.Path):
        return run(
            "bash", str(CAPTURE), str(theme), str(rollback_root),
            DEPLOYMENT_ID, str(manifest),
        )

    def deploy(self, stage: pathlib.Path, theme: pathlib.Path) -> None:
        for source in stage.rglob("*"):
            if source.is_file():
                target = theme / source.relative_to(stage)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)

    def test_manifest_is_sorted_exact_and_rejects_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            stage, _, _, rollback_root, manifest = self.layout(root, "build-a")
            rows = [line.split("\t") for line in manifest.read_text().splitlines()]
            self.assertEqual([row[2] for row in rows], sorted(row[2] for row in rows))
            self.assertEqual(len(rows), 4)
            for digest, size, relative in rows:
                self.assertEqual(digest, sha(stage / relative))
                self.assertEqual(int(size), (stage / relative).stat().st_size)

            bad_stage = root / "bad-stage"
            bad_stage.mkdir()
            (bad_stage / "link").symlink_to(stage / "style.css")
            result = run(
                "python3", str(GENERATE), str(bad_stage),
                str(rollback_root / "bad.tsv"), check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("non-regular", result.stderr + result.stdout)

    def test_capture_covers_exact_stage_and_rollback_is_exact(self):
        with tempfile.TemporaryDirectory() as temporary:
            stage, _, theme, rollback_root, manifest = self.layout(pathlib.Path(temporary), "build-a")
            result = self.capture(theme, rollback_root, manifest)
            self.assertIn("stage=4 existing=2 absent=2", result.stdout)
            bundle = rollback_root / DEPLOYMENT_ID
            self.assertTrue(bundle.is_dir())
            self.assertEqual(len((bundle / "before-state.tsv").read_text().splitlines()), 4)
            self.assertEqual(
                set((bundle / "absent-paths.txt").read_text().splitlines()),
                {"dashboard/index.html", "dashboard/_next/static/build-a/_buildManifest.js"},
            )

            self.deploy(stage, theme)
            run(
                "bash", str(ROLLBACK), "--execute-approved-rollback", str(theme),
                str(rollback_root), DEPLOYMENT_ID, str(bundle),
            )
            self.assertEqual((theme / "functions.php").read_text(), "old functions\n")
            self.assertEqual((theme / "style.css").read_text(), "old style\n")
            self.assertFalse((theme / "dashboard/index.html").exists())
            self.assertFalse((theme / "dashboard/_next/static/build-a/_buildManifest.js").exists())
            self.assertEqual((theme / "unlisted.txt").read_text(), "preserve me\n")

    def test_rollback_validates_all_current_hashes_before_mutation(self):
        with tempfile.TemporaryDirectory() as temporary:
            stage, _, theme, rollback_root, manifest = self.layout(pathlib.Path(temporary), "build-a")
            self.capture(theme, rollback_root, manifest)
            bundle = rollback_root / DEPLOYMENT_ID
            self.deploy(stage, theme)
            write(theme / "style.css", "concurrent edit\n")
            before_functions = (theme / "functions.php").read_bytes()
            result = run(
                "bash", str(ROLLBACK), "--execute-approved-rollback", str(theme),
                str(rollback_root), DEPLOYMENT_ID, str(bundle), check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("does not match deployed or original state", result.stderr)
            self.assertEqual((theme / "functions.php").read_bytes(), before_functions)
            self.assertEqual((theme / "style.css").read_text(), "concurrent edit\n")

    def test_rollback_safely_handles_partial_deploy(self):
        with tempfile.TemporaryDirectory() as temporary:
            stage, _, theme, rollback_root, manifest = self.layout(pathlib.Path(temporary), "build-a")
            self.capture(theme, rollback_root, manifest)
            bundle = rollback_root / DEPLOYMENT_ID
            write(theme / "style.css", "new style\n")
            write(theme / "dashboard/index.html", "<h1>new dashboard</h1>\n")
            run(
                "bash", str(ROLLBACK), "--execute-approved-rollback", str(theme),
                str(rollback_root), DEPLOYMENT_ID, str(bundle),
            )
            self.assertEqual((theme / "functions.php").read_text(), "old functions\n")
            self.assertEqual((theme / "style.css").read_text(), "old style\n")
            self.assertFalse((theme / "dashboard/index.html").exists())
            self.assertFalse((theme / "dashboard/_next/static/build-a/_buildManifest.js").exists())

    def test_capture_is_independent_of_build_id(self):
        covered = []
        for build_id in ("build-a", "build-b"):
            with self.subTest(build_id=build_id), tempfile.TemporaryDirectory() as temporary:
                stage, _, theme, rollback_root, manifest = self.layout(pathlib.Path(temporary), build_id)
                self.capture(theme, rollback_root, manifest)
                bundle = rollback_root / DEPLOYMENT_ID
                manifest_paths = {line.split("\t", 2)[2] for line in (bundle / "actual-deploy-manifest.tsv").read_text().splitlines()}
                state_paths = {line.split("\t", 6)[6] for line in (bundle / "before-state.tsv").read_text().splitlines()}
                self.assertEqual(manifest_paths, state_paths)
                self.assertIn(f"dashboard/_next/static/{build_id}/_buildManifest.js", state_paths)
                covered.append(state_paths)
        self.assertNotEqual(covered[0], covered[1])

    def test_failed_capture_removes_only_its_private_staging_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            _, _, theme, rollback_root, manifest = self.layout(root, "build-a")
            original = {p.relative_to(theme): p.read_bytes() for p in theme.rglob("*") if p.is_file()}
            rows = manifest.read_text().splitlines()
            rows[1] = "invalid-hash\t1\tbroken.txt"
            manifest.write_text("\n".join(rows) + "\n")
            result = run(
                "bash", str(CAPTURE), str(theme), str(rollback_root),
                DEPLOYMENT_ID, str(manifest), check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(manifest.exists())
            self.assertFalse((rollback_root / f".staging-{DEPLOYMENT_ID}").exists())
            self.assertFalse((rollback_root / DEPLOYMENT_ID).exists())
            current = {p.relative_to(theme): p.read_bytes() for p in theme.rglob("*") if p.is_file()}
            self.assertEqual(current, original)

    def test_capture_requires_existing_live_functions_and_cleans_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            _, _, theme, rollback_root, manifest = self.layout(root, "build-a")
            (theme / "functions.php").unlink()
            result = run(
                "bash", str(CAPTURE), str(theme), str(rollback_root),
                DEPLOYMENT_ID, str(manifest), check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("theme root is unavailable", result.stderr)
            self.assertFalse(manifest.exists())
            self.assertFalse((rollback_root / f".staging-{DEPLOYMENT_ID}").exists())

    def test_workflow_captures_after_preactivation_before_first_theme_upload(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        deploy = workflow[workflow.index("      - name: Verify remote theme directory and deploy"):]
        capture = deploy.index("capture-xserver-rollback.sh")
        preactivation = deploy.index("coverage_private_preflight\n")
        first_theme_upload = deploy.index('for dependency in "${PREDEPLOY_PHP_DEPENDENCIES[@]}"')
        self.assertLess(preactivation, capture)
        self.assertLess(capture, first_theme_upload)
        self.assertIn("generate-xserver-deploy-manifest.py", workflow)
        self.assertNotIn("generateBuildId", (ROOT / "dashboard/next.config.ts").read_text())
        self.assertNotIn("--delete", deploy)
        self.assertNotIn("rm -rf", (ROOT / "scripts/xserver-rollback-from-snapshot.sh").read_text())

    def test_rollback_restores_functions_before_removing_created_dependencies(self):
        script = (ROOT / "scripts/xserver-rollback-from-snapshot.sh").read_text()
        restore_dependencies = script.index("# Restore old dependencies")
        restore_functions = script.index("# Restore the previous functions.php")
        remove_created = script.index("# Only the old functions.php is now active")
        self.assertLess(restore_dependencies, restore_functions)
        self.assertLess(restore_functions, remove_created)

    def test_workflow_serializes_xserver_deployments(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        self.assertIn("group: xserver-production-deploy", workflow)
        self.assertIn("cancel-in-progress: false", workflow)


if __name__ == "__main__":
    unittest.main()
