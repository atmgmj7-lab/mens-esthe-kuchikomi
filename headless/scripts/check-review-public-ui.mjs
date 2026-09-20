import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const consumers = [
  "app/page.tsx",
  "app/reviews/page.tsx",
  "app/shops/[slug]/page.tsx",
  "app/shops/[slug]/reviews/page.tsx",
  "lib/priority-area-hub.ts",
];
for (const path of consumers) {
  const source = read(path);
  assert.match(source, /publicReviewAdapter/);
  assert.doesNotMatch(source, /getApprovedShopReviews|getApprovedReviewsPage/);
}

const modelSource = read("lib/shop-review-view-model.ts");
assert.match(modelSource, /PublicShopReviewResult/);
assert.match(modelSource, /PublicReview/);
assert.match(modelSource, /MINIMUM_GRAPH_RESPONSES\s*=\s*3/);
const shopDetail = read("components/ShopDetail.tsx");
const seo = read("lib/seo.ts");
assert.match(shopDetail, /buildShopReviewViewModel\(reviewResult\)/);
assert.doesNotMatch(shopDetail, /review_star|review_count|shop_review_count/);
assert.match(seo, /ratingCount:\s*reviewModel\.aggregateRatingCount/);
assert.match(seo, /reviewCount:\s*reviewModel\.totalApproved/);

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

const model = loadTypeScript("lib/shop-review-view-model.ts", {
  "server-only": {},
});
const review = (id, rating) => ({
  id,
  body: `Review ${id}`,
  submittedAt: "2026-09-20T00:00:00.000Z",
  ratings: { total: rating, price: rating, service: rating, cleanliness: rating },
});
const result = (ratings) => ({
  status: "available",
  source: "supabase",
  page: {
    reviews: ratings.map((rating, index) => review(`11111111-1111-4111-8111-11111111111${index}`, rating)),
    total: ratings.length,
    totalPages: 1,
    page: 1,
    metrics: Object.fromEntries(["total", "price", "service", "cleanliness"].map((key) => [key, {
      average: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
      responseCount: ratings.length,
    }])),
    dateRange: {
      oldestSubmittedAt: "2026-09-20T00:00:00.000Z",
      latestSubmittedAt: "2026-09-20T00:00:00.000Z",
    },
  },
});
const two = model.buildShopReviewViewModel(result([5, 1]));
assert.equal(two.showGraph, false);
assert.equal(two.aggregateRating, null);
assert.equal(two.metrics.length, 0);
const three = model.buildShopReviewViewModel(result([5, 1, 3]));
assert.equal(three.showGraph, true);
assert.equal(three.aggregateRating, 3);
assert.equal(three.aggregateRatingCount, 3);
assert.equal(three.totalApproved, 3);
assert.equal(typeof three.latest[0].id, "string", "Supabase UUID must survive the UI view model");

console.log("Review public UI/rating/schema source contract passed");
