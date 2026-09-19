"""Read-only source/deployment invariants; never connect or dispatch a writer."""
import pathlib, subprocess, tempfile, unittest
ROOT = pathlib.Path(__file__).resolve().parents[2]
class Deployment(unittest.TestCase):
    def test_preflight_precedes_every_activation(self):
        s=(ROOT/'.github/workflows/deploy.yml').read_text()
        start=s.index('      - name: Verify remote theme directory and deploy')
        s=s[start:s.index('      - name: Post-deploy REST check',start)]
        self.assertIn('build-coverage-private-preflight.py',s)
        self.assertEqual(s.count('coverage_private_preflight\n'),2)
        self.assertLess(s.index('coverage_private_preflight\n'),s.index('for dependency in'))
        self.assertLess(s.rindex('coverage_private_preflight\n'),s.rindex('"$STAGE_DIR/functions.php"'))
        self.assertGreater(s.rindex('coverage_private_preflight\n'),s.index('"$STAGE_DIR/"'))
        self.assertNotIn('--delete',s)
    def test_no_private_stage(self):
        s=(ROOT/'.github/workflows/deploy.yml').read_text()
        for value in ['outputs/','private/','data/coverage-first/','recovery-contracts.json']:
            self.assertIn("--exclude='"+value+"'",s)
        with tempfile.TemporaryDirectory() as t:
            stage=pathlib.Path(t); (stage/'data/coverage-first').mkdir(parents=True)
            (stage/'data/coverage-first/private.json').write_text('{}')
            run=subprocess.run(['bash',str(ROOT/'scripts/validate-xserver-deploy-stage.sh'),t,str(ROOT/'scripts/xserver-predeploy-php-dependencies.txt')],capture_output=True,text=True)
            self.assertNotEqual(run.returncode,0)
            self.assertIn('private coverage',run.stderr)
    def test_dependency_order(self):
        deps=(ROOT/'scripts/xserver-predeploy-php-dependencies.txt').read_text().splitlines()
        self.assertLess(deps.index('coverage-private-runtime.php'),deps.index('coverage-batch-writer.php'))
        self.assertIn('shop-public-meta.php',deps)
    def test_preflight_is_not_runtime_dispatch(self):
        p=subprocess.run(['python3',str(ROOT/'scripts/build-coverage-private-preflight.py')],capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr)
        # An absent local site must fail closed, without bootstrapping WordPress.
        with tempfile.TemporaryDirectory() as t:
            run=subprocess.run(['php','-r','eval(stream_get_contents(STDIN));','--',t],input=p.stdout,capture_output=True,text=True)
            self.assertNotEqual(run.returncode,0)
            self.assertIn('COVERAGE_PRIVATE_PREFLIGHT=FAIL',run.stdout)
            self.assertNotIn(t,run.stdout+run.stderr)
if __name__ == '__main__': unittest.main()
