import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPhase4Summary,
  validatePhase4Dataset
} from "./lib/sakaisujihonmachi-phase4-data.mjs";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const datasetPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-30-shops-2026-07-15.json"
);
const previewPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json"
);
const obsoleteWordPressPreviewPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-wordpress-preview-2026-07-15.json"
);
const reportPath = join(
  repoRoot,
  "docs",
  "seo",
  "sakaisujihonmachi-phase4-data-report-2026-07-15.md"
);

assert.ok(existsSync(datasetPath), "Phase 4 dataset is missing");
const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
validatePhase4Dataset(dataset);

const duplicateId = structuredClone(dataset);
duplicateId.shops[1].wp_post_id = duplicateId.shops[0].wp_post_id;
assert.throws(() => validatePhase4Dataset(duplicateId), /WordPress IDs must be unique/);

const verifiedWithoutSource = structuredClone(dataset);
verifiedWithoutSource.shops[0].official_name = {
  status: "verified",
  value: verifiedWithoutSource.shops[0].wordpress_title,
  source_ids: []
};
assert.throws(() => validatePhase4Dataset(verifiedWithoutSource), /requires a primary source/);

const thirdPartySource = structuredClone(dataset);
const shopWithSource = thirdPartySource.shops.find((shop) => shop.sources.length > 0);
shopWithSource.sources[0].url = "https://refle.info/example";
assert.throws(() => validatePhase4Dataset(thirdPartySource), /uses a non-primary host/);

const unverifiedZero = structuredClone(dataset);
const unverifiedShop = unverifiedZero.shops.find((shop) => shop.official_name.status === "unverified");
unverifiedShop.official_name.value = 0;
assert.throws(() => validatePhase4Dataset(unverifiedZero), /unverified value must be null/);

const invalidRepresentative = structuredClone(dataset);
const multiCourseShop = invalidRepresentative.shops.find(
  (shop) => shop.prices.status === "verified" && shop.prices.courses.filter((course) => course.representative_eligible).length > 1
);
const alternativeCourseIndex = multiCourseShop.prices.courses.findIndex(
  (course, index) => course.representative_eligible && index !== multiCourseShop.prices.representative_course_index
);
multiCourseShop.prices.representative_course_index = alternativeCourseIndex;
assert.throws(() => validatePhase4Dataset(invalidRepresentative), /representative course violates the fixed rule/);

const reviewInjection = structuredClone(dataset);
reviewInjection.shops[0].review_score = 5;
assert.throws(() => validatePhase4Dataset(reviewInjection), /prohibited in Phase 4 data/);

const openEndedHours = structuredClone(dataset);
const sourcedShop = openEndedHours.shops.find((shop) => shop.business_hours.status === "verified");
sourcedShop.business_hours.value.display = "11:00〜LAST";
sourcedShop.business_hours.value.opens_at = "11:00";
sourcedShop.business_hours.value.closes_at = null;
sourcedShop.business_hours.value.closes_next_day = false;
validatePhase4Dataset(openEndedHours);

const summary = buildPhase4Summary(dataset);
assert.equal(summary.total_shops, 30);

assert.ok(existsSync(previewPath), "Supabase draft preview file is missing");
assert.ok(existsSync(reportPath), "Phase 4 report file is missing");

const report = readFileSync(reportPath, "utf8");
assert.match(report, /ローカルSupabase非公開draft投入: 2回実行・検証済み/);
assert.match(report, /本番Supabase非公開draft投入: 未実施/);
assert.match(report, /Supabase公開切替: 未実施/);

const preview = JSON.parse(readFileSync(previewPath, "utf8"));
assert.equal(preview.mode, "supabase-draft-preview");
assert.equal(preview.apply_status, "not-applied");
assert.equal(preview.public_data_source, "wordpress");
assert.equal(preview.target_data_store, "supabase");
assert.deepEqual(preview.target_state, {
  shops_publication_status: "draft",
  rows_is_public: false,
  public_cutover: false
});
assert.deepEqual(preview.target_tables, [
  "app.shops",
  "app.shop_prices",
  "app.shop_business_hours",
  "app.sources",
  "app.shop_source_links"
]);
assert.equal(preview.shops.length, 30, "Supabase draft preview must contain exactly 30 shops");
assert.equal(new Set(preview.shops.map((shop) => shop.wp_post_id)).size, 30, "Supabase draft preview IDs must be unique");
assert.deepEqual(
  preview.shops.map((shop) => shop.wp_post_id),
  dataset.shops.map((shop) => shop.wp_post_id),
  "Supabase draft preview shop order must match the fixed dataset"
);

const allowedShopPatchFields = new Set([
  "wp_post_id",
  "name",
  "official_url",
  "phone",
  "address_text",
  "access_text",
  "booking_url",
  "legacy_payload_patch",
  "publication_status",
  "published_at"
]);

function assertNoProhibitedFieldNames(value, path = "preview") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProhibitedFieldNames(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, /(?:review|rating|口コミ|評価)/i, `${path}.${key} is prohibited`);
    assertNoProhibitedFieldNames(child, `${path}.${key}`);
  }
}

for (const shop of preview.shops) {
  assert.ok(Number.isSafeInteger(shop.wp_post_id), "Supabase draft preview shop ID is required");
  assert.ok(shop.wordpress_comparison && typeof shop.wordpress_comparison === "object");
  assert.ok(!Object.hasOwn(shop, "wordpress_update_candidate"), "WordPress update candidates are obsolete");

  if (!shop.eligible_for_draft_import) {
    assert.equal(shop.supabase_draft_candidate, null);
    continue;
  }

  const candidate = shop.supabase_draft_candidate;
  assert.ok(candidate && typeof candidate === "object");
  assert.equal(candidate.shop_patch.wp_post_id, shop.wp_post_id);
  assert.equal(candidate.shop_patch.publication_status, "draft");
  assert.equal(candidate.shop_patch.published_at, null);
  for (const key of Object.keys(candidate.shop_patch)) {
    assert.ok(allowedShopPatchFields.has(key), `Supabase shop patch includes unsupported field ${key}`);
  }
  for (const price of candidate.prices) {
    assert.ok(price.amount_yen > 0);
    assert.equal(price.is_public, false);
    assert.match(price.verified_at, /^2026-07-15T/);
  }
  if (candidate.prices.length > 0) {
    assert.equal(
      candidate.prices.filter((price) => price.notes === "Phase 4代表料金").length,
      1,
      `Supabase draft ${shop.wp_post_id} must have exactly one representative price`
    );
  }
  for (const hours of candidate.business_hours) {
    assert.equal(hours.is_public, false);
    assert.match(hours.verified_at, /^2026-07-15T/);
  }
  for (const source of candidate.sources) {
    assert.equal(source.source_kind, "official");
    assert.match(source.verified_at, /^2026-07-15T/);
  }
  assert.equal(
    new Set(candidate.sources.map((source) => `${source.source_kind}:${source.source_url}`)).size,
    candidate.sources.length,
    `Supabase draft ${shop.wp_post_id} sources must be unique by kind and URL`
  );
  for (const link of candidate.source_links) {
    assert.equal(link.wp_post_id, shop.wp_post_id);
    assert.equal(link.verification_status, "verified");
    assert.equal(link.is_public, false);
  }
}

assert.deepEqual(preview.summary, {
  shops_eligible: 26,
  shop_prices: 89,
  shop_business_hours: 23,
  source_observations: 72,
  sources: 71,
  shop_source_links: 189
});
assert.equal(existsSync(obsoleteWordPressPreviewPath), false, "Obsolete WordPress update preview must be removed");
assertNoProhibitedFieldNames(preview);

console.log("30 shops checked; verified facts have primary sources");
