import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  join(root, "..", "supabase", "migrations", "20261017122000_eskomi_canonical_integrity_fixes.sql"),
  "utf8",
);
const verification = readFileSync(
  join(root, "..", "supabase", "tests", "verify_eskomi_canonical_integrity_fixes.sql"),
  "utf8",
);
const benefitIndependence = readFileSync(
  join(root, "..", "supabase", "migrations", "20261017123000_eskomi_benefit_publication_independence.sql"),
  "utf8",
);
const acceptanceSafety = readFileSync(
  join(root, "..", "supabase", "migrations", "20261017124000_eskomi_review_entry_acceptance_safety.sql"),
  "utf8",
);
const v2ExecutionVerification = readFileSync(
  join(root, "..", "supabase", "tests", "verify_eskomi_review_entry_v2.sql"),
  "utf8",
);

assert.doesNotMatch(
  migration.match(/create or replace function api\.list_unlisted_managed_shop_legacy_identities\(\)[\s\S]*?\$\$;/)?.[0] ?? "",
  /join\s+private\.managed_shop_publications/i,
  "legacy suppression must include unpublished tombstones",
);
assert.doesNotMatch(
  migration.match(/create or replace function api\.list_managed_shop_legacy_listing_states\(\)[\s\S]*?\$\$;/)?.[0] ?? "",
  /join\s+private\.managed_shop_publications/i,
  "archive list must include unpublished tombstones",
);
assert.match(migration, /partner_workspaces_wp_shop_id_positive_check[\s\S]*wp_shop_id is null or wp_shop_id > 0/i,
  "nullable legacy identity must still be positive when supplied");
assert.match(migration, /benefit_programs_workspace_shop_fk[\s\S]*references private\.partner_workspaces\(id, app_shop_id\)/i,
  "benefit programs must match workspace and app shop");
assert.match(migration, /v_experience\.state = 'approved' and p_decision <> 'withdrawn'/,
  "approved experiences must be withdrawable and other terminal transitions remain idempotent");
assert.match(migration, /update app\.review_publications[\s\S]*archived_at = now\(\)/,
  "withdrawal must archive the public projection");
assert.match(migration, /review_withdrawn/,
  "withdrawal must publish a distinct cache/widget invalidation event");
assert.match(migration, /create or replace function api\.list_public_review_publications[\s\S]*archived_at is null/,
  "public reads must omit withdrawn publications");
assert.match(verification, /unpublished deleted tombstone was omitted/, "local regression must exercise tombstone suppression");
assert.match(verification, /benefit program accepted a shop outside its workspace/, "local regression must exercise workspace/shop ownership");
assert.match(benefitIndependence, /Deliberately do not mutate private\.benefit_codes here/, "withdrawal must not cancel an issued benefit");
assert.doesNotMatch(benefitIndependence, /update private\.benefit_codes[\s\S]*state = 'void'/, "withdrawal cannot void issued benefits");
assert.match(verification, /retaining the neutral benefit/, "local regression must preserve a neutral benefit after withdrawal");
assert.match(acceptanceSafety, /publication_state = 'deleted'[\s\S]*managed_shop_archive_events/, "draft imports must be distinguished from archive tombstones");
assert.match(acceptanceSafety, /shop\.publication_status = 'published'/, "entry, submission and public reads must require a published shop");
assert.match(acceptanceSafety, /submit_review_experience_v2/, "accepted submission requires a separate v2 transaction");
assert.match(acceptanceSafety, /eligibility_rule = 'accepted_submission'/, "benefits must be issued from accepted submission rather than publication");
assert.match(acceptanceSafety, /drop constraint if exists benefit_programs_eligibility_rule_check[\s\S]*update private\.benefit_programs/s,
  "the legacy eligibility check must be removed before rows are migrated");
assert.match(acceptanceSafety, /assessment\.experience_id = v_experience_id/,
  "RETURNS TABLE output variables must not shadow assessment columns");
assert.match(acceptanceSafety, /extensions\.gen_random_bytes\(16\)/,
  "benefit codes must retain at least 128 bits of randomness");
assert.match(v2ExecutionVerification, /private\.submit_review_experience_v2\(/,
  "disposable SQL verification must execute the v2 receipt transaction");
assert.match(v2ExecutionVerification, /\^ESK-\[0-9A-F\]\{32\}\$/,
  "verification must assert the 128-bit rendered code format");

console.log("Eskomi canonical integrity contract: PASS");
