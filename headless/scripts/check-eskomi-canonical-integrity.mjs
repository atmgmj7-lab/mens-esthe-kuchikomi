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
assert.match(verification, /approved withdrawal did not atomically remove public projection/, "local regression must exercise withdrawal projection removal");

console.log("Eskomi canonical integrity contract: PASS");
