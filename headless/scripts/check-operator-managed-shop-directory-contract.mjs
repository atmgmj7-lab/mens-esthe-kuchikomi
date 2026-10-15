import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = join(root, "../supabase/migrations/20261015031602_operator_managed_shop_directory.sql");
const assetApiMigration = join(root, "../supabase/migrations/20261015033500_operator_managed_shop_asset_api.sql");
const visibilityMigration = join(root, "../supabase/migrations/20261015033805_operator_managed_shop_visibility_and_nullable_fields.sql");
const workflowApiMigration = join(root, "../supabase/migrations/20261015034000_operator_managed_shop_workflow_api.sql");
const assetVisibilityMigration = join(root, "../supabase/migrations/20261015034200_operator_managed_shop_asset_visibility.sql");
const fixture = join(root, "../supabase/tests/verify_operator_managed_shop_directory.sql");

assert.ok(existsSync(migration), "managed-shop migration is required");
assert.ok(existsSync(fixture), "managed-shop local SQL fixture is required");
const sql = readFileSync(migration, "utf8");
const assetApiSql = readFileSync(assetApiMigration, "utf8");
const visibilitySql = readFileSync(visibilityMigration, "utf8");
const workflowApiSql = readFileSync(workflowApiMigration, "utf8");
const assetVisibilitySql = readFileSync(assetVisibilityMigration, "utf8");
const testSql = readFileSync(fixture, "utf8");

for (const token of [
  "create table private.managed_shops",
  "create table private.managed_shop_revisions",
  "create table private.managed_shop_publications",
  "create table private.managed_shop_assets",
  "create table private.managed_shop_reviews",
  "alter table private.managed_shops enable row level security",
  "revoke all on table private.managed_shops",
  "private.import_managed_shop_from_legacy",
  "private.create_managed_shop",
  "private.save_managed_shop_draft",
  "private.submit_managed_shop_revision",
  "private.review_managed_shop_revision",
  "api.get_operator_managed_shop_page",
  "api.get_operator_managed_shop_detail",
  "api.list_published_managed_shops",
]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${token}`);

assert.doesNotMatch(sql, /grant\s+.*\s+on\s+table\s+private\.managed_shop.*\s+to\s+(anon|authenticated)/i, "private directory must never be browser-readable");
assert.doesNotMatch(sql, /grant\s+execute\s+on\s+function\s+api\.(?:create|save|submit|review)_managed_shop.*\s+to\s+(anon|authenticated)/i, "operator write RPCs must be service-only");
assert.match(assetApiSql, /api\.get_published_managed_shop_asset/, "asset getter must verify an approved publication");
assert.doesNotMatch(assetApiSql, /grant\s+execute\s+on\s+function\s+api\.(?:attach|get_published)_managed_shop_asset.*\s+to\s+(anon|authenticated)/i, "asset RPCs must remain service-only");
assert.match(assetVisibilitySql, /s\.publication_state='published'/, "unlisted managed stores must not expose private image objects through the proxy");
assert.match(visibilitySql, /publication_state text not null default 'unlisted'/, "new directory records must start non-public");
assert.match(visibilitySql, /private\.set_managed_shop_visibility/, "visibility must use a controlled operator workflow");
assert.match(visibilitySql, /where s\.publication_state='published'/, "public list must exclude unlisted stores");
assert.doesNotMatch(visibilitySql, /grant\s+execute\s+on\s+function\s+api\.set_managed_shop_visibility.*\s+to\s+(anon|authenticated)/i, "visibility RPC must remain service-only");
for (const rpc of ["import_managed_shop_from_legacy", "create_managed_shop", "save_managed_shop_draft", "submit_managed_shop_revision", "review_managed_shop_revision"]) {
  assert.match(workflowApiSql, new RegExp(`api\\.${rpc}`), `${rpc} needs an API wrapper`);
  assert.doesNotMatch(workflowApiSql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+api\\.${rpc}.*\\s+to\\s+(anon|authenticated)`, "i"), `${rpc} wrapper must remain service-only`);
}

for (const token of [
  "legacy slug identity mismatch",
  "draft leaked to managed public projection",
  "stale managed revision was accepted",
  "cross-store asset was accepted",
  "unlisted managed publication remained publicly listed",
  "republished managed publication is unavailable",
  "legacy-compatible managed draft rejected a missing official URL",
  "anonymous_role_can_read_managed_directory",
]) assert.match(testSql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `fixture must cover ${token}`);

console.log("operator managed-shop directory source contract: PASS");
