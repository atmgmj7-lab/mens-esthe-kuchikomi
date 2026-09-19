# Local validation and proof boundary

Task: WP-COVERAGE-PRIVATE-RUNTIME-CONTRACT-01. Starting foundation SHA: `9b04ce8d1b3561fe24ae83d8fd7a10879f930f84`. The corrective source is reviewed independently; the final commit/evidence hashes are recorded in the local result packet.

## Results

- Fail-first: missing sanitized writer rejected by combined test; missing deployment guards rejected by four deployment tests; missing loader rejected by private runtime test. Subsequent focused tests PASS.
- `php tests/php/check-coverage-private-runtime.php`: always-active synthetic assertions for config structure/version/records/identities/kinds, duplicate JSON keys, malformed JSON, digest, paths, file/parent permissions, symlinks, bounded reads, and readonly0400/0500 inputs.
- `php tests/php/check-coverage-runtime.php`: both writers plus public projection load together; four distinct routes, audit/init hooks, preserved guarded include, foundation allowlists, missing private state rejected before dispatch.
- `php tests/php/check-coverage-retry-guard.php`: actual pure validator body with isolated boundary stubs; missing private recovery identity refuses the retry before downstream WordPress reads. No coverage apply/reconcile function executed.
- `python3 tests/php/check-coverage-deployment.py`: 4/4. Candidate preflight before any runtime upload and immediately before functions.php, private stage rejection, dependency order, standalone missing-state rejection.
- Existing official-facts/price-booking writer: 124 cumulative assertions; public projection/native guard PASS. Provenance/cross-language Node23 and Python13 PASS.
- New isolated local MariaDB fixture: real InnoDB CAS/readback/rollback tests46 PASS, preserving LINE/phone contributors. Fixture stopped/removed afterwards. These are official-facts tests using WP API boundary shims, not production WordPress or coverage operations.
- Full headless `npm test`: PASS on clean candidate source copy. Initial in-worktree attempt failed because a repository-wide branding scanner read prior untracked rollback PHP evidence. The clean QA copy excludes evidence, retains all tracked files and candidate source, and uses its own Git index and copied installed dependencies. No test weakening or baseline source change. A temporary missing-Git and symlink/Turbopack harness issue in that QA copy was corrected before its successful run.
- `npm run lint`, `npm run typecheck`, `npm run build`: PASS in the working checkout; build850/850. No repeated main build.
- PHP syntax, shell syntax, `git diff --check`: PASS.
- Current public GET population58/25 and existing production-reader ordering regression31 assertions PASS, including after-midnight22/9 and LINE19/5. Featured config remains712/768 and both shops remain present. Comparison/prefill/SEO/schema source unchanged; full regression suite covers existing contracts. No new browser/production deployment proof claimed.

## Private equivalence and scan

Local private migration inputs live outside the repository under directory0700/files0600. Extraction script's output equals the manually captured literal structure. Original and loaded canonical recovery maps are identical, record count3, structure SHA256 `2b4999b41b789f24c7ac78dde2f222690809d63c120439111939b1adba4ffc68`. Both manifest digests match the source-pinned expected values, and candidate standalone preflight passes against that private local site layout. No recovery values or manifest payloads are in this document.

Source scan compares actual private operation identities, audit/post IDs, payload hashes, titles/slugs against staged added text without printing values. It also checks credential signatures, local-home paths and private payload artifact paths. PASS. Exact candidate hashes, scan results, fresh-live hashes, equivalence and command logs remain under local untracked outputs; they are not deployable source.

Seven current live source/manifest hashes are unchanged at closing read. Origin/main remained the specified baseline. Live functions.php differs from the corrected candidate only by the intended price/booking public include; all unrelated live content is preserved. Foundation runtime PHP remains byte-identical to the original reviewed foundation commit.

## Not performed

No production provisioning, push, deploy, WordPress write, ACF mutation, coverage apply/reconcile, Supabase write or Secret/env mutation. Live private-root/web-PHP access, code deployment and full WP/ACF lifecycle remain future gates. Local preflight PASS does not assert that the unprovisioned production private root is ready. The original live code remains active.
