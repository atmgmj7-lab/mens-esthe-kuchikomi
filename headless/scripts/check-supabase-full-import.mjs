import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(headlessRoot, "..");
const preparerPath = join(headlessRoot, "scripts", "prepare-supabase-full-import.mjs");
const importPath = join(repoRoot, "supabase", "imports", "20260714_wordpress_382_shops.sql");
const verifyPath = join(repoRoot, "supabase", "imports", "verify_20260714_wordpress_382_shops.sql");

const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");
assert.match(
  gitignore,
  /^supabase\/imports\/\*\.sql$/m,
  "Full WordPress import SQL must never be added to Git"
);

assert.ok(existsSync(preparerPath), `Full import preparer must exist: ${preparerPath}`);
assert.equal(
  existsSync(importPath),
  existsSync(verifyPath),
  "Full import SQL and verification SQL must be generated or removed together"
);

const packageJson = JSON.parse(readFileSync(join(headlessRoot, "package.json"), "utf8"));
assert.equal(
  packageJson.scripts?.["supabase:prepare-full-import"],
  "node scripts/prepare-supabase-full-import.mjs"
);

const {
  normalizeTrialArea,
  normalizeTrialShop,
  renderFullImportSql,
  renderFullVerifySql
} = await import("./lib/supabase-trial-sql.mjs");

assert.equal(typeof normalizeTrialArea, "function", "Full import requires an area normalizer");
assert.equal(typeof renderFullImportSql, "function", "Full import SQL renderer must be exported");
assert.equal(typeof renderFullVerifySql, "function", "Full import verifier must be exported");

const areas = [
  normalizeTrialArea({ id: 2, slug: "osaka", name: "大阪", parent: 0, description: "", count: 2 }),
  normalizeTrialArea({ id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", parent: 2, description: "", count: 1 })
];

const shops = [
  normalizeTrialShop({
    id: 10,
    slug: "multi-area-shop",
    title: { rendered: "複数地域店" },
    content: { rendered: "" },
    excerpt: { rendered: "" },
    area: [2, 46],
    featured_media: 100,
    _embedded: { "wp:featuredmedia": [{ id: 100, source_url: "https://example.com/10.jpg" }] },
    acf: { basic_price: "12000", official_url: "", shop_address: "大阪市中央区" }
  }),
  normalizeTrialShop({
    id: 20,
    slug: "no-area-shop",
    title: { rendered: "地域未設定店" },
    content: { rendered: "" },
    excerpt: { rendered: "" },
    area: [],
    featured_media: 0,
    acf: { basic_price: "0", official_url: "", shop_address: "" }
  })
];

const options = {
  shops,
  areas,
  batchId: "ba4e67ba-8769-4bba-b1d4-ed77076c7c4f",
  sourceUrl: "https://example.com/wp-json/wp/v2/shop",
  selectedAt: "2026-07-14T00:00:00.000Z"
};

const importSql = renderFullImportSql(options);
const verifySql = renderFullVerifySql(options);

assert.match(importSql, /create temporary table full_import_areas/i);
assert.match(importSql, /create temporary table full_import_shops/i);
assert.match(importSql, /-- area wp_term_id=2/);
assert.match(importSql, /-- area wp_term_id=46/);
assert.match(importSql, /-- shop wp_post_id=10/);
assert.match(importSql, /-- shop wp_post_id=20/);
assert.match(importSql, /jsonb_array_elements_text/i, "All WordPress area relations must be expanded");
assert.match(importSql, /parent_id = parents\.id/i, "Area hierarchy must be restored after upsert");
assert.match(importSql, /publication_status[\s\S]{0,160}?'draft'/i);
assert.doesNotMatch(importSql, /insert\s+into\s+app\.(?:reviews|contents)\b/i);
assert.doesNotMatch(importSql, /\bis_public\s*=\s*true\b/i);

assert.match(verifySql, /Expected 2 nonpublic areas/i);
assert.match(verifySql, /Expected 2 draft shops/i);
assert.match(verifySql, /Expected 2 WordPress area links/i);
assert.match(verifySql, /Expected 1 nonpublic prices/i);
assert.match(verifySql, /Expected 1 nonpublic images/i);
assert.match(verifySql, /api\.published_reviews/i);
assert.match(verifySql, /set local role anon/i);

if (existsSync(importPath)) {
  const fixedImportSql = readFileSync(importPath, "utf8");
  const fixedVerifySql = readFileSync(verifyPath, "utf8");
  assert.equal([...fixedImportSql.matchAll(/-- shop wp_post_id=(\d+)/g)].length, 382);
  assert.equal([...fixedImportSql.matchAll(/-- area wp_term_id=(\d+)/g)].length, 34);
  assert.match(fixedVerifySql, /Expected 382 draft shops/i);
  assert.match(fixedVerifySql, /Expected 34 nonpublic areas/i);
  assert.match(fixedVerifySql, /Expected 252 nonpublic prices/i);
  assert.match(fixedVerifySql, /Expected 241 nonpublic images/i);
}

console.log("Supabase full WordPress import contract passed.");
