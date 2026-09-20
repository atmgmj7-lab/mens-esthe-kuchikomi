import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const adapterPath = resolve(root, "lib/reviews/public-adapter.ts");
assert.ok(existsSync(adapterPath), "Supabase public Review adapter must exist");

const read = (path) => readFileSync(resolve(root, path), "utf8");
const source = read("lib/reviews/public-adapter.ts");
const migration = read("../supabase/migrations/20260920062938_review_native_foundation.sql");

assert.match(source, /^import "server-only";/);
assert.match(source, /REVIEW_READ_SOURCE/);
assert.match(source, /wordpress/);
assert.match(source, /supabase/);
for (const predicate of [
  "source_type = 'user-review'",
  "moderation_status = 'approved'",
  "publication_status = 'published'",
  "r.is_public",
  "not r.is_ai_generated",
  "not r.is_promotion",
  "r.approved_at is not null",
  "r.published_at is not null",
]) assert.match(migration, new RegExp(predicate.replaceAll(".", "\\."), "i"));
for (const forbidden of ["nickname", "email", "abuse_key", "idempotency", "actor_label", "moderation_reason", "campaign_token"])
  assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`, "i"));

function loadTypeScript(path, dependencies) {
  const output = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency in ${path}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const calls = [];
const publishedShop = {
  id: 712,
  publicationStatus: "publish",
  slug: "current-slug",
  title: "Current WordPress Shop",
  primaryArea: { id: 7, slug: "umeda", name: "梅田" },
  terms: [
    { id: 7, slug: "umeda", name: "梅田", parent: 0, count: 1, taxonomy: "area" },
    { id: 8, slug: "osaka", name: "大阪", parent: 0, count: 1, taxonomy: "area" },
  ],
};
const draftShop = {
  ...publishedShop,
  id: 713,
  publicationStatus: "draft",
  slug: "draft-shop",
  title: "Draft Shop",
};
const uuid = "11111111-1111-4111-8111-111111111111";
const nativeReview = {
  reviewId: uuid,
  shop: { wpShopId: 712 },
  body: "Supabase public body",
  submittedAt: "2026-09-20T00:00:00.000Z",
  publishedAt: "2026-09-20T01:00:00.000Z",
  rating: 5,
  ratingPrice: 4,
  ratingService: 5,
  ratingCleanliness: 4,
  visitPeriod: null,
  revisitIntent: null,
};
const nativeMetrics = {
  shop: { wpShopId: 712 },
  reviewCount: 1,
  overall: { average: 5, responseCount: 1 },
  price: { average: 4, responseCount: 1 },
  service: { average: 5, responseCount: 1 },
  cleanliness: { average: 4, responseCount: 1 },
  oldestSubmittedAt: nativeReview.submittedAt,
  latestSubmittedAt: nativeReview.submittedAt,
};
const repository = {
  async listPublished(request) {
    calls.push(["list", request]);
    return { status: "ok", data: [nativeReview] };
  },
  async getPublishedMetrics(request) {
    calls.push(["metrics", request]);
    return { status: "ok", data: { ...nativeMetrics, shop: request.shop } };
  },
};
const wpShopResult = {
  status: "available",
  page: { reviews: [], total: 0, totalPages: 0, page: 1, metrics: {}, dateRange: null },
};
const wpGlobalResult = {
  status: "available",
  page: { reviews: [], total: 0, totalPages: 0, page: 1 },
};
const module = loadTypeScript("lib/reviews/public-adapter.ts", {
  "server-only": {},
  "@/lib/supabase/review-native": { reviewNativeRepository: repository },
  "@/lib/wp/reviews": {
    getApprovedShopReviews: async (...args) => { calls.push(["wp-shop", args]); return wpShopResult; },
    getApprovedReviewsPage: async (...args) => { calls.push(["wp-global", args]); return wpGlobalResult; },
  },
  "@/lib/wp/shops": {
    getAllShopsForListing: async () => [publishedShop, draftShop],
  },
});

assert.equal(module.resolveReviewReadSource({}), "wordpress");
assert.equal(module.resolveReviewReadSource({ REVIEW_READ_SOURCE: "wordpress" }), "wordpress");
assert.equal(module.resolveReviewReadSource({ REVIEW_READ_SOURCE: "supabase" }), "supabase");
assert.equal(module.resolveReviewReadSource({ REVIEW_READ_SOURCE: "unexpected" }), "wordpress");

let adapter = module.createPublicReviewAdapter({
  repository,
  readWordPressShopReviews: async (...args) => { calls.push(["wp-shop", args]); return wpShopResult; },
  readWordPressGlobalReviews: async (...args) => { calls.push(["wp-global", args]); return wpGlobalResult; },
  listWordPressShops: async () => [publishedShop, draftShop],
  environment: {},
});
calls.length = 0;
let result = await adapter.getShopReviews(publishedShop, 1, 20);
assert.equal(result.source, "wordpress");
assert.equal(calls[0][0], "wp-shop");
assert.equal(calls.some(([name]) => name === "list"), false, "default source must not read Supabase");

adapter = module.createPublicReviewAdapter({
  repository,
  readWordPressShopReviews: async () => wpShopResult,
  readWordPressGlobalReviews: async () => wpGlobalResult,
  listWordPressShops: async () => [publishedShop, draftShop],
  environment: { REVIEW_READ_SOURCE: "supabase" },
});
calls.length = 0;
result = await adapter.getShopReviews(draftShop, 1, 20);
assert.equal(result.status, "unavailable");
assert.equal(calls.length, 0, "non-public WordPress Shop must fail before Supabase read");

result = await adapter.getShopReviews(publishedShop, 1, 20);
assert.equal(result.status, "available");
assert.equal(result.source, "supabase");
assert.equal(result.page.reviews[0].id, uuid);
assert.equal(result.page.total, 1);
assert.equal(result.page.metrics.total.responseCount, 1);
assert.deepEqual(Object.keys(result.page.reviews[0]).sort(), ["body", "id", "ratings", "submittedAt"].sort());

calls.length = 0;
result = await adapter.getGlobalReviews(1, 20, "umeda");
assert.equal(result.status, "available");
assert.equal(result.page.reviews[0].shop.id, 712);
assert.equal(result.page.reviews[0].shop.slug, "current-slug");
assert.equal(result.page.reviews[0].shop.primaryArea.slug, "umeda");
assert.deepEqual(calls.find(([name]) => name === "list")[1].wpShopIds, [712]);
assert.equal(JSON.stringify(result).includes("Draft Shop"), false);

repository.listPublished = async () => ({
  status: "ok",
  data: [{ ...nativeReview, shop: { wpShopId: 999999 } }],
});
result = await adapter.getGlobalReviews(1, 20, null);
assert.equal(result.status, "unavailable", "unknown WordPress Shop identity must fail closed");

console.log("Review public adapter contract passed");
