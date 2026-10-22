import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20261022182857_scoped_wordpress_public_facts_projection.sql"), "utf8");
const targetIds = [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];

assert.match(migration, /create or replace function api\.get_public_site_directory_v1\(\)/u, "the existing public directory RPC must retain its identity");
assert.match(migration, /security definer\s+set search_path = app, api, pg_temp/u, "the existing constrained security-definer search_path must be retained");
assert.match(migration, /s\.publication_status = 'published'/u, "published-only eligibility must be retained");
assert.match(migration, /managed\.publication_state <> 'published'/u, "managed withdrawal exclusion must be retained");
assert.match(migration, /legacy_public_facts/u, "the public response must label the narrow allowlist projection");
for (const id of targetIds) assert.match(migration, new RegExp(`\\b${id}\\b`, "u"), `allowlist must retain WP ${id}`);
for (const key of ["shop_tel", "shop_address", "shop_access", "shop_booking_url", "shop_hours", "shop_booking", "basic_price"]) assert.match(migration, new RegExp(`'${key}'`, "u"), `allowlist must include only reviewed field ${key}`);
assert.match(migration, /case when s\.wp_post_id = any\(array\[/u, "facts must be conditional on the exact WordPress allowlist");
assert.match(migration, /jsonb_strip_nulls\(jsonb_build_object\(/u, "the projection must omit absent public facts rather than invent values");
assert.match(migration, /case when legacy_public_facts is null or legacy_public_facts = '\{\}'::jsonb then '\{\}'::jsonb/u, "non-allowlisted shops must not receive an empty projection key");
assert.doesNotMatch(migration, /(?:grant|revoke|alter table|create policy|enable row level security|disable row level security)\b/iu, "the narrow display projection must not alter ACL or RLS");
assert.doesNotMatch(migration, /'legacy_payload'\s*,\s*legacy_payload/u, "the private metadata blob must never be returned");

console.log("Scoped WordPress public-facts projection contract: PASS");
