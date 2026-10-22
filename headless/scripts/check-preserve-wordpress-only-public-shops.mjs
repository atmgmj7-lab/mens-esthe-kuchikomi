import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationPath = resolve(projectRoot, "supabase/migrations/20261022180959_preserve_wordpress_only_public_shops.sql");
const migration = readFileSync(migrationPath, "utf8");
const expectedIds = [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
const expectedSlugs = ["eskomi-m0064", "eskomi-m0145", "eskomi-m0167", "eskomi-m0250", "eskomi-m0251", "eskomi-m0287", "eskomi-m0293", "eskomi-m0408", "eskomi-m0654", "eskomi-m0660", "eskomi-m0661", "eskomi-m0663", "eskomi-m0668", "eskomi-m0757"];

assert.match(migration, /^begin;/imu, "the narrowly scoped preservation migration must be transactional");
assert.match(migration, /expected 382 app\.shops before preservation/u, "the migration must refuse an unexpected pre-state");
assert.match(migration, /expected 379 published app\.shops before preservation/u, "the migration must pin the pre-state public count");
assert.match(migration, /target WordPress identities already exist/u, "the migration must refuse duplicate target identities");
assert.match(migration, /target slug or canonical path collides/u, "the migration must refuse duplicate public URLs");
assert.match(migration, /expected all three existing target areas to be published/u, "the migration must require the existing public area set");
assert.match(migration, /expected 14 preserved shops after insert/u, "the migration must verify the exact inserted row count");
assert.match(migration, /expected 29 preserved WordPress area links/u, "the migration must verify every existing multi-area relation");
assert.match(migration, /no preserved shop may gain a primary area/u, "the migration must forbid inferred primary areas");
assert.match(migration, /expected 393 published app\.shops after preservation/u, "the migration must verify the new public count");
assert.match(migration, /expected 396 app\.shops after preservation/u, "the migration must verify that no unrelated draft was changed");
assert.match(migration, /source_system\)\s*\nselect shops\.id, areas\.id, false, 'wordpress'/u, "all imported area relations must preserve the source without choosing a primary");
assert.doesNotMatch(migration, /(?:insert into|update|delete from)\s+(?:private\.|app\.)?(?:managed_shops|partner_|review|shop_images|shop_prices|shop_business_hours|contents)/iu, "the narrow migration must not create managed state, reviews, media, prices, hours, or content");
assert.doesNotMatch(migration, /\b(?:grant|revoke|create policy|alter table|enable row level security)\b/iu, "the narrow migration must not change ACL or RLS");

const sourceMatch = migration.match(/\$source\$(?<json>[\s\S]*?)\$source\$::jsonb/u);
assert.ok(sourceMatch?.groups?.json, "the migration must retain its exact reviewed WordPress source payload");
const source = JSON.parse(sourceMatch.groups.json);
assert.equal(source.length, 14, "the source payload must contain exactly the approved rows");
assert.deepEqual(source.map((row) => row.wp_post_id).sort((a, b) => a - b), expectedIds, "the source payload must contain only the approved WordPress IDs");
assert.deepEqual(source.map((row) => row.slug).sort(), expectedSlugs, "the source payload must contain only the approved legacy slugs");
assert.ok(source.every((row) => row.source_status === "publish"), "every imported WordPress record must have been publicly published at capture");
assert.ok(source.every((row) => row.canonical_path === `/shops/${row.slug}/`), "each preserved legacy URL must remain its own canonical path");
assert.ok(source.every((row) => row.description_html === "" && row.excerpt === "" && row.featured_media === null && row.image_url === null), "the migration must not invent body text or images");
assert.ok(source.every((row) => Array.isArray(row.area_ids) && row.area_ids.length >= 2), "every existing source-area membership must be retained");
assert.equal(source.flatMap((row) => row.area_ids).length, 29, "the payload must retain all 29 reviewed area links");
assert.ok(source.every((row) => row.area_ids.every((id) => [2, 13, 17].includes(id))), "the payload must be limited to the reviewed existing areas");

console.log("WordPress-only public-shop preservation migration contract: PASS");
