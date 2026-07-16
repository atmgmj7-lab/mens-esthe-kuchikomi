import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(headlessRoot, "..");
const previewPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json"
);
const modulePath = join(headlessRoot, "scripts", "lib", "sakaisujihonmachi-phase4-supabase-sql.mjs");
const preparerPath = join(headlessRoot, "scripts", "prepare-sakaisujihonmachi-phase4-supabase-import.mjs");
const importPath = join(
  repoRoot,
  "supabase",
  "imports",
  "20260715_sakaisujihonmachi_phase4_verified_draft.sql"
);
const verifyPath = join(
  repoRoot,
  "supabase",
  "imports",
  "verify_20260715_sakaisujihonmachi_phase4_verified_draft.sql"
);

assert.ok(existsSync(modulePath), `Phase 4 Supabase SQL renderer must exist: ${modulePath}`);
assert.ok(existsSync(preparerPath), `Phase 4 Supabase preparer must exist: ${preparerPath}`);
assert.equal(
  existsSync(importPath),
  existsSync(verifyPath),
  "Phase 4 import SQL and verification SQL must be generated or removed together"
);

const packageJson = JSON.parse(readFileSync(join(headlessRoot, "package.json"), "utf8"));
assert.equal(
  packageJson.scripts?.["supabase:prepare-sakaisujihonmachi-phase4"],
  "node scripts/prepare-sakaisujihonmachi-phase4-supabase-import.mjs"
);

const {
  PHASE4_BATCH_ID,
  renderPhase4ImportSql,
  renderPhase4VerifySql,
  validatePhase4DraftPreview
} = await import("./lib/sakaisujihonmachi-phase4-supabase-sql.mjs");

assert.match(PHASE4_BATCH_ID, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.equal(typeof validatePhase4DraftPreview, "function");
assert.equal(typeof renderPhase4ImportSql, "function");
assert.equal(typeof renderPhase4VerifySql, "function");

const preview = JSON.parse(readFileSync(previewPath, "utf8"));
validatePhase4DraftPreview(preview);
const importSql = renderPhase4ImportSql(preview);
const verifySql = renderPhase4VerifySql(preview);

assert.equal([...importSql.matchAll(/-- phase4 shop wp_post_id=(\d+)/g)].length, 26);
for (const table of [
  "phase4_draft_shops",
  "phase4_draft_prices",
  "phase4_draft_hours",
  "phase4_draft_sources",
  "phase4_draft_source_links"
]) {
  assert.match(importSql, new RegExp(`create temporary table ${table}`, "i"));
}
for (const table of [
  "app.shops",
  "app.shop_prices",
  "app.shop_business_hours",
  "app.sources",
  "app.shop_source_links",
  "private.import_batches",
  "private.import_records"
]) {
  assert.match(importSql, new RegExp(`(?:insert into|update) ${table.replace(".", "\\.")}`, "i"));
}
assert.match(importSql, /publication_status\s*=\s*'draft'/i);
assert.match(importSql, /legacy_payload\s*=\s*shops\.legacy_payload\s*\|\|/i);
assert.match(importSql, /phase4-source:2026-07-15/i);
assert.match(
  importSql,
  /'phase4-source:2026-07-15; '\s*\|\|\s*\(hours\.payload\s*->>\s*'notes'\)/i,
  "Business-hours notes must extract JSON text before string concatenation"
);
assert.doesNotMatch(importSql, /insert\s+into\s+app\.(?:reviews|contents)\b/i);
assert.doesNotMatch(importSql, /\bis_public\s*=\s*true\b/i);
assert.doesNotMatch(importSql, /\bgrant\b|create\s+table/i);

for (const expectation of [
  "Expected 26 Phase 4 draft shops",
  "Expected 89 Phase 4 nonpublic prices",
  "Expected 23 Phase 4 nonpublic business hours",
  "Expected 71 Phase 4 official sources",
  "Expected 189 Phase 4 nonpublic source links",
  "Expected completed Phase 4 batch with 26 records"
]) {
  assert.match(verifySql, new RegExp(expectation));
}
assert.match(verifySql, /duplicate_prices[\s\S]*?<>\s*0/i);
assert.match(verifySql, /duplicate_hours[\s\S]*?<>\s*0/i);
assert.match(verifySql, /set local role anon/i);
for (const view of [
  "published_areas",
  "published_shops",
  "published_shop_areas",
  "published_shop_prices",
  "published_shop_business_hours",
  "published_shop_images",
  "published_shop_sources",
  "published_contents",
  "published_reviews"
]) {
  assert.match(verifySql, new RegExp(`api\\.${view}`, "i"));
}

if (existsSync(importPath)) {
  assert.equal(readFileSync(importPath, "utf8"), importSql);
  assert.equal(readFileSync(verifyPath, "utf8"), verifySql);
}

console.log("Sakaisujihonmachi Phase 4 Supabase draft import contract passed.");
