import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(headlessRoot, "..");
const packagePath = join(headlessRoot, "package.json");
const trialDir = join(repoRoot, "supabase", "trials");
const importPath = join(trialDir, "20260714_sakaisujihonmachi_3_shops.sql");
const verifyPath = join(trialDir, "verify_20260714_sakaisujihonmachi_3_shops.sql");
const generatorPath = join(headlessRoot, "scripts", "lib", "supabase-trial-sql.mjs");
const preparerPath = join(headlessRoot, "scripts", "prepare-supabase-30-shop-trial.mjs");
const thirtyImportPath = join(trialDir, "20260714_sakaisujihonmachi_30_shops.sql");
const thirtyVerifyPath = join(trialDir, "verify_20260714_sakaisujihonmachi_30_shops.sql");

assert.ok(existsSync(importPath), `Trial import SQL must exist: ${importPath}`);
assert.ok(existsSync(verifyPath), `Trial verification SQL must exist: ${verifyPath}`);
assert.ok(existsSync(generatorPath), `Trial SQL generator must exist: ${generatorPath}`);
assert.ok(existsSync(preparerPath), `30-shop trial preparer must exist: ${preparerPath}`);

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
assert.equal(
  packageJson.scripts?.["supabase:prepare-30-shop-trial"],
  "node scripts/prepare-supabase-30-shop-trial.mjs"
);

const {
  SAKAISUJIHONMACHI_30_SHOP_IDS,
  normalizeTrialShop,
  renderTrialImportSql,
  renderTrialVerifySql
} = await import("./lib/supabase-trial-sql.mjs");

const expectedThirtyShopIds = [
  654, 655, 656, 657, 660, 662, 670, 674, 675, 678,
  683, 686, 687, 689, 695, 696, 697, 701, 706, 708,
  709, 715, 723, 799, 826, 853, 1203, 1210, 1221, 1237
];

assert.deepEqual(SAKAISUJIHONMACHI_30_SHOP_IDS, expectedThirtyShopIds);
assert.equal(typeof normalizeTrialShop, "function", "Trial shop normalizer must be exported");
assert.equal(typeof renderTrialImportSql, "function", "Trial import SQL renderer must be exported");
assert.equal(typeof renderTrialVerifySql, "function", "Trial verification SQL renderer must be exported");

const normalizedTrialShop = normalizeTrialShop({
  id: 999,
  slug: "sample-shop",
  title: { rendered: "Sample Shop" },
  content: { rendered: "" },
  excerpt: { rendered: "" },
  area: [46, 2],
  featured_media: 555,
  _embedded: {
    "wp:featuredmedia": [{ id: 555, source_url: "https://example.com/sample.jpg" }]
  },
  acf: {
    basic_price: "0",
    official_url: "",
    shop_tel: "",
    shop_address: "堺筋本町 / 堺筋本町駅より徒歩3分",
    shop_hours: "10:00〜翌2:00",
    shop_booking: "完全予約制"
  }
});

assert.deepEqual(
  {
    wp_post_id: normalizedTrialShop.wp_post_id,
    canonical_path: normalizedTrialShop.canonical_path,
    official_url: normalizedTrialShop.official_url,
    phone: normalizedTrialShop.phone,
    address_text: normalizedTrialShop.address_text,
    access_text: normalizedTrialShop.access_text,
    basic_price: normalizedTrialShop.basic_price,
    featured_media: normalizedTrialShop.featured_media,
    image_url: normalizedTrialShop.image_url,
    area_ids: normalizedTrialShop.area_ids,
    issues: normalizedTrialShop.issues
  },
  {
    wp_post_id: 999,
    canonical_path: "/shops/sample-shop/",
    official_url: null,
    phone: null,
    address_text: null,
    access_text: "堺筋本町 / 堺筋本町駅より徒歩3分",
    basic_price: null,
    featured_media: 555,
    image_url: "https://example.com/sample.jpg",
    area_ids: [46, 2],
    issues: [
      "address-access-mixed",
      "price-missing",
      "image-unverified",
      "official-url-missing",
      "multi-area-source"
    ]
  }
);

assert.ok(existsSync(thirtyImportPath), `30-shop trial import SQL must exist: ${thirtyImportPath}`);
assert.ok(existsSync(thirtyVerifyPath), `30-shop verification SQL must exist: ${thirtyVerifyPath}`);

const sql = readFileSync(importPath, "utf8");
const verifySql = readFileSync(verifyPath, "utf8");
const expectedShopIds = [695, 709, 1237];
const shopMarkers = [...sql.matchAll(/-- shop wp_post_id=(\d+)/g)].map((match) => Number(match[1]));

assert.deepEqual(shopMarkers.sort((a, b) => a - b), expectedShopIds);
assert.match(sql, /wp_term_id[\s\S]*?46/, "Sakaisujihonmachi WordPress term 46 must be preserved");
assert.match(sql, /is_published[\s\S]*?false/, "The trial area must remain nonpublic");
assert.equal(
  [...sql.matchAll(/publication_status[\s\S]{0,220}?'draft'/g)].length >= 3,
  true,
  "All three trial shops must remain drafts"
);
assert.doesNotMatch(sql, /insert\s+into\s+app\.(?:reviews|contents)\b/i);
assert.doesNotMatch(sql, /\bis_public\s*=\s*true\b/i);
assert.match(sql, /private\.import_batches/i);
assert.match(sql, /private\.import_records/i);

for (const shopId of expectedShopIds) {
  assert.match(sql, new RegExp(`'${shopId}'`), `Import record for WordPress shop ${shopId} is required`);
}

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
  assert.match(verifySql, new RegExp(`api\\.${view}`, "i"), `Verification must check api.${view}`);
}

assert.match(verifySql, /raise exception/i, "Verification must fail closed on public leakage");
assert.match(verifySql, /stored_shops[\s\S]*?=\s*3/i, "Verification must require exactly 3 stored shops");
assert.match(verifySql, /stored_areas[\s\S]*?=\s*1/i, "Verification must require exactly 1 stored area");

const thirtySql = readFileSync(thirtyImportPath, "utf8");
const thirtyVerifySql = readFileSync(thirtyVerifyPath, "utf8");
const thirtyMarkers = [...thirtySql.matchAll(/-- shop wp_post_id=(\d+)/g)]
  .map((match) => Number(match[1]));
const trialPayloadMatch = thirtySql.match(/\$trial\$(\[[\s\S]*?\])\$trial\$::jsonb/);

assert.deepEqual(thirtyMarkers, expectedThirtyShopIds);
assert.ok(trialPayloadMatch, "30-shop SQL must contain a fixed JSON trial payload");

const thirtyPayload = JSON.parse(trialPayloadMatch[1]);
assert.equal(thirtyPayload.length, 30, "30-shop SQL must contain exactly 30 shops");
assert.deepEqual(thirtyPayload.map((shop) => shop.wp_post_id), expectedThirtyShopIds);
assert.equal(thirtyPayload.filter((shop) => shop.basic_price).length, 25);
assert.equal(thirtyPayload.filter((shop) => shop.image_url).length, 23);
assert.equal(thirtyPayload.filter((shop) => !shop.official_url).length, 15);
assert.equal(thirtyPayload.every((shop) => shop.area_ids.includes(46)), true);

assert.match(thirtySql, /set local statement_timeout = '30s'/i);
assert.match(thirtySql, /create temporary table trial_import_shops/i);
assert.match(thirtySql, /publication_status[\s\S]{0,120}?'draft'/i);
assert.doesNotMatch(thirtySql, /insert\s+into\s+app\.(?:reviews|contents)\b/i);
assert.doesNotMatch(thirtySql, /\bis_public\s*=\s*true\b/i);
assert.match(thirtySql, /private\.import_batches/i);
assert.match(thirtySql, /private\.import_records/i);

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
  assert.match(
    thirtyVerifySql,
    new RegExp(`api\\.${view}`, "i"),
    `30-shop verification must check api.${view}`
  );
}

assert.match(thirtyVerifySql, /raise exception/i);
assert.match(thirtyVerifySql, /stored_shops[\s\S]*?=\s*30/i);
assert.match(thirtyVerifySql, /stored_links[\s\S]*?=\s*30/i);
assert.match(thirtyVerifySql, /stored_prices[\s\S]*?=\s*25/i);
assert.match(thirtyVerifySql, /stored_images[\s\S]*?=\s*23/i);
assert.match(thirtyVerifySql, /stored_records[\s\S]*?=\s*30/i);

console.log("Supabase 3-shop and 30-shop trial import contracts passed.");
