import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const headlessDirectory = resolve(scriptsDirectory, "..");
const repositoryDirectory = resolve(headlessDirectory, "..");
const runnerPath = join(scriptsDirectory, "run-eskomi-v11-synthetic-baseline-rehearsal.sh");
const fixturePath = join(repositoryDirectory, "supabase/tests/fixture_eskomi_20261015182000_synthetic_baseline.sql");
const verificationPath = join(repositoryDirectory, "supabase/tests/verify_eskomi_20261015182000_synthetic_rehearsal.sql");
const evidencePath = join(repositoryDirectory, "docs/technical/artifacts/2026-10-18-synthetic-20261015182000-rehearsal.md");

assert.equal(existsSync(runnerPath), true, "synthetic baseline rehearsal runner must exist");
assert.equal(existsSync(fixturePath), true, "synthetic baseline fixture must exist");
assert.equal(existsSync(verificationPath), true, "synthetic baseline verification must exist");
assert.equal(existsSync(evidencePath), true, "synthetic baseline evidence must exist");

const runner = readFileSync(runnerPath, "utf8");
assert.match(runner, /20261015182000/u, "runner must use the authorized ledger boundary");
assert.match(runner, /--internal/u, "runner must use an isolated Docker network");
assert.doesNotMatch(runner, /supabase_db_mens-esthe-kuchikomi/u, "runner must not reuse the local Supabase database");
assert.doesNotMatch(runner, /--network host/u, "runner must not use host networking");
assert.doesNotMatch(runner, /(?:^|\s)-p\s|--publish/u, "runner must not publish host ports");
assert.doesNotMatch(runner, /\/var\/run\/docker\.sock/u, "runner must not mount the Docker socket");
assert.match(runner, /fixture_eskomi_20261015182000_synthetic_baseline/u, "runner must seed only the synthetic baseline");
assert.match(runner, /verify_eskomi_20261015182000_synthetic_rehearsal/u, "runner must run the synthetic verification");
assert.match(runner, /verify_eskomi_public_review_read_rpc/u, "runner must exercise the anonymous public-review reader against the synthetic database");
assert.match(runner, /ESKOMI_SYNTHETIC_BASELINE_PROVE_NON_TARGET_GUARD/u, "runner must expose the expected-failure non-target guard proof mode");

const fixture = readFileSync(fixturePath, "utf8");
assert.match(fixture, /generate_series\(1,381\)/u, "fixture must create 381 synthetic non-pilot shops");
assert.match(fixture, /768/u, "fixture must include the synthetic Mrs.Rank UP legacy identity");
assert.match(fixture, /free_official_partner/u, "fixture must preserve the observed workspace state shape");
assert.doesNotMatch(fixture, /mrs-rankup\.com|東淀川区|本番/u, "fixture must not copy real production facts");

const verification = readFileSync(verificationPath, "utf8");
assert.match(verification, /list_legacy_partner_workspace_mapping_candidates_v11/u, "verification must inspect the exact mapping candidate");
assert.match(verification, /bind_legacy_managed_shop_to_app_shop_v11/u, "verification must use the existing exact bind path");
assert.match(verification, /map_legacy_partner_workspace_to_canonical_v11/u, "verification must use the existing workspace mapping path");
assert.match(verification, /review_canonical_managed_shop_revision/u, "verification must publish through the normal managed review path");
assert.match(verification, /v_workspace_725/u, "verification must retain the first non-target workspace UUID");
assert.match(verification, /v_workspace_766/u, "verification must retain the second non-target workspace UUID");
assert.match(verification, /out-of-scope legacy workspaces were modified/u, "verification must reject a changed non-target workspace by UUID");
assert.match(verification, /out-of-scope legacy workspaces gained aliases/u, "verification must reject aliases on either non-target workspace");
assert.match(verification, /inject_non_target_mapping/u, "verification must support the intentional abnormal-fixture proof");

const evidence = readFileSync(evidencePath, "utf8");
assert.match(evidence, /PostgreSQL superuser `psql`/u, "evidence must state the superuser fixture scope");
assert.match(evidence, /does \*\*not\*\* prove the normal Next request/u, "evidence must exclude Next/Auth/RLS proof");
assert.match(evidence, /ESKOMI_SYNTHETIC_BASELINE_PROVE_NON_TARGET_GUARD/u, "evidence must describe the expected-failure guard proof");

console.log("Eskomi synthetic 20261015182000 baseline rehearsal contract: PASS");
