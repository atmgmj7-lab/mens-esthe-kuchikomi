import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(root, "../supabase/migrations/20261014200000_partner_listing_editor.sql");
const bannerMigrationPath = join(root, "../supabase/migrations/20261014210000_partner_listing_assets_and_public_route.sql");
const sqlFixture = join(root, "../supabase/tests/verify_partner_listing_editor.sql");

assert.ok(existsSync(migrationPath), "Partner listing editor migration is required");
const migration = readFileSync(migrationPath, "utf8");
assert.ok(existsSync(bannerMigrationPath), "Partner banner migration is required");
const bannerMigration = readFileSync(bannerMigrationPath, "utf8");
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
assert.match(fixture, /another Partner attached a banner to this store/);

console.log("partner listing editor source contract: PASS");
