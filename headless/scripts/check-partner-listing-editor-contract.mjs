import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(root, "../supabase/migrations/20261014200000_partner_listing_editor.sql");
const bannerMigrationPath = join(root, "../supabase/migrations/20261014210000_partner_listing_assets_and_public_route.sql");
const bannerApiMigrationPath = join(root, "../supabase/migrations/20261014213000_partner_listing_banner_api_wrappers.sql");
const repeatApprovalMigrationPath = join(root, "../supabase/migrations/20261014230030_partner_listing_repeat_approval.sql");
const sqlFixture = join(root, "../supabase/tests/verify_partner_listing_editor.sql");

assert.ok(existsSync(migrationPath), "Partner listing editor migration is required");
const migration = readFileSync(migrationPath, "utf8");
assert.ok(existsSync(bannerMigrationPath), "Partner banner migration is required");
const bannerMigration = readFileSync(bannerMigrationPath, "utf8");
assert.ok(existsSync(bannerApiMigrationPath), "Partner banner API migration is required");
const bannerApiMigration = readFileSync(bannerApiMigrationPath, "utf8");
assert.ok(existsSync(repeatApprovalMigrationPath), "repeat-approval migration is required");
const repeatApprovalMigration = readFileSync(repeatApprovalMigrationPath, "utf8");
const fixture = readFileSync(sqlFixture, "utf8");

for (const token of [
  "create table private.listing_stores",
  "create table private.listing_store_revisions",
  "create table private.listing_store_publications",
  "create table private.listing_store_reviews",
  "private.save_partner_listing_draft",
  "private.submit_partner_listing_change",
  "private.review_partner_listing_change",
  "private.create_listing_store",
  "api.get_partner_listing_editor",
]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${token}`);

assert.match(fixture, /another Partner was allowed to edit this store/);
assert.match(fixture, /returned revision leaked to public projection/);
assert.match(fixture, /duplicate approval was accepted/);
assert.match(fixture, /existing application granted ownership/);
for (const token of ["private.partner_listing_banner_uploads", "private.reserve_partner_listing_banner_upload", "private.attach_partner_listing_banner_asset", "api.get_public_partner_listing_banner"]) assert.match(bannerMigration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${token}`);
for (const token of ["api.reserve_partner_listing_banner_upload", "api.attach_partner_listing_banner_asset", "grant execute on function api.reserve_partner_listing_banner_upload", "grant execute on function api.attach_partner_listing_banner_asset"]) assert.match(bannerApiMigration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${token}`);
assert.match(fixture, /another Partner attached a banner to this store/);
for (const token of [
  "drop index if exists private.listing_applications_listing_store_id_unique",
  "v_previous.state not in ('draft','changes_requested','approved')",
  "listing store has an active pending revision",
]) assert.match(repeatApprovalMigration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${token}`);
assert.match(fixture, /Partner could not start a new draft after approval/);
assert.match(fixture, /multiple applications were not retained against the existing stable store/);

console.log("partner listing editor source contract: PASS");
