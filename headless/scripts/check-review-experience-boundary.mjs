import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => {
  const absolutePath = join(root, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
};

function compileModule(path, requireMap = {}) {
  const source = read(path);
  assert.ok(source, `${path} must exist`);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const loaded = { exports: {} };
  const require = (id) => {
    if (id in requireMap) return requireMap[id];
    throw new Error(`Unexpected require from ${path}: ${id}`);
  };
  vm.runInNewContext(
    compiled,
    { module: loaded, exports: loaded.exports, require, URL, Date, console },
    { filename: `${path}.cjs` }
  );
  return loaded.exports;
}

const provenance = compileModule("lib/content-provenance.ts");
const approved = provenance.normalizeContentItem({
  id: 501,
  sourcePostType: "reviews",
  source: "user",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "承認済み口コミ",
  rating: 5
});
assert.equal(approved.contentKind, "approved-user-review");
assert.equal(approved.canDisplayAsUserReview, true);
assert.equal(approved.canUseForAggregateRating, true);

for (const item of [
  { sourceType: "editorial-comment", approvalStatus: "approved", status: "publish", shopId: 101, body: "編集部記事", rating: 5 },
  { sourceType: "shop-reply", approvalStatus: "approved", status: "publish", shopId: 101, body: "店舗回答", rating: 5 },
  { sourceType: "promotion", approvalStatus: "approved", status: "publish", shopId: 101, body: "PR", rating: 5 },
  { sourcePostType: "reviews", source: "user", approvalStatus: "pending", status: "pending", shopId: 101, body: "未承認", rating: 5 }
]) {
  const normalized = provenance.normalizeContentItem(item);
  assert.equal(normalized.canCountAsUserReview, false);
  assert.equal(normalized.canUseForAggregateRating, false);
}

const rating = compileModule("lib/review-rating.ts", {
  "@/lib/content-provenance": provenance
});
const aggregate = rating.calculateAggregateRating([
  { sourcePostType: "reviews", source: "user", approvalStatus: "approved", status: "publish", shopId: 101, body: "A", rating: 5 },
  { sourcePostType: "reviews", source: "user", approvalStatus: "approved", status: "publish", shopId: 101, body: "B", rating: 4 },
  { sourcePostType: "reviews", source: "user", approvalStatus: "approved", status: "publish", shopId: 101, body: "C", rating: 3 },
  { sourceType: "editorial-comment", approvalStatus: "approved", status: "publish", shopId: 101, body: "編集部", rating: 1 },
  { sourceType: "shop-reply", approvalStatus: "approved", status: "publish", shopId: 101, body: "店舗回答", rating: 1 },
  { sourceType: "promotion", approvalStatus: "approved", status: "publish", shopId: 101, body: "PR", rating: 1 }
]);
assert.equal(aggregate.reviewCount, 3);
assert.equal(aggregate.eligibleReviewCount, 3);
assert.equal(aggregate.ratingValue, 4);

const boundary = compileModule("lib/ux-production-data-boundary.ts");
assert.equal(boundary.reviewContentAvailability("approved-user-review").status, "available");
for (const capability of ["therapistId", "helpfulCount", "shopReply", "qa", "experienceVerified"]) {
  assert.equal(boundary.REVIEW_EXPERIENCE_CAPABILITIES[capability].status, "unavailable");
}

const relationContext = { shopId: 101, shopSlug: "fixture-shop", areaId: 10, areaSlug: "osaka" };
const directRelation = boundary.approvedReviewRelation(501, 101, relationContext);
assert.ok(directRelation, "matching canonical source and context shop IDs must create a relation");
assert.equal(directRelation.shopId, 101, "matching canonical source and context shop IDs must create a relation");
assert.equal(
  boundary.approvedReviewRelation(501, 101, { ...relationContext, shopId: 202 }),
  null,
  "a source review for shop 101 must not be rebound to shop 202"
);

let commonRelationCalls = 0;
const observedBoundary = {
  ...boundary,
  approvedReviewRelation: (...args) => {
    commonRelationCalls += 1;
    return boundary.approvedReviewRelation(...args);
  }
};

const readerPayload = {
  items: [{
    id: 501,
    body: "承認済み口コミ",
    submittedAt: "2026-08-15T00:00:00+09:00",
    ratingTotal: 5,
    ratingPrice: 5,
    ratingService: 5,
    ratingCleanliness: 5
  }],
  total: 1,
  totalPages: 1,
  page: 1,
  metrics: {
    total: { average: 5, responseCount: 1 },
    price: { average: 5, responseCount: 1 },
    service: { average: 5, responseCount: 1 },
    cleanliness: { average: 5, responseCount: 1 }
  },
  dateRange: {
    oldestSubmittedAt: "2026-08-15T00:00:00+09:00",
    latestSubmittedAt: "2026-08-15T00:00:00+09:00"
  }
};
const reviewReader = compileModule("lib/wp/reviews.ts", {
  "next/cache": { cacheLife: () => undefined, cacheTag: () => undefined },
  "@/lib/wp/client": { wpFetch: async () => readerPayload }
});
assert.equal(
  typeof reviewReader.getApprovedShopReviewsWithSource,
  "function",
  "the real approved-review reader must expose a source-bound wrapper"
);
const source = await reviewReader.getApprovedShopReviewsWithSource(101, 1, 20);
assert.equal(source.shopId, 101);
assert.equal(reviewReader.isApprovedShopReviewSource(source), true);

const viewModel = compileModule("lib/shop-review-view-model.ts", {
  "server-only": {},
  "@/lib/ux-production-data-boundary": observedBoundary,
  "@/lib/wp/reviews": reviewReader
});
const relations = await viewModel.buildApprovedShopReviewRelations(source, relationContext);
assert.equal(relations.length, 1);
assert.equal(relations[0].reviewId, 501);
assert.equal(relations[0].shopId, 101);
assert.equal(relations[0].shopSlug, "fixture-shop");
assert.equal(relations[0].areaId, 10);
assert.equal(relations[0].areaSlug, "osaka");
assert.equal(relations[0].therapistId, null);
assert.equal(commonRelationCalls, 1, "the relation adapter must call the shared production relation function");
assert.equal(
  (await viewModel.buildApprovedShopReviewRelations({ shopId: 101, result: source.result }, relationContext)).length,
  0,
  "caller-assembled result and shop ID objects must not be accepted as canonical reader sources"
);
assert.equal((await viewModel.buildApprovedShopReviewRelations(source)).length, 0, "reviews without canonical shop/area context must not enter discovery");
assert.equal((await viewModel.buildApprovedShopReviewRelations(source, { ...relationContext, areaId: 0 })).length, 0);
assert.equal(
  (await viewModel.buildApprovedShopReviewRelations(source, { ...relationContext, shopId: 202 })).length,
  0,
  "the local source shop identity must reject a different caller context"
);

assert.equal(boundary.reviewContentAvailability("editorial-comment").status, "unavailable");
const editorialFieldAvailability = boundary.reviewContentAvailability("editorial-comment", {
  field: "editorial_comment"
});
assert.equal(editorialFieldAvailability.status, "available");
assert.equal(editorialFieldAvailability.authority, "wordpress-shop-editorial-field");
assert.equal(boundary.reviewContentAvailability("editorial-article").status, "unavailable");
const formalEditorialSource = {
  wpPostId: 9001,
  postType: "post",
  slug: "osaka-esthe-guide",
  link: "https://mens-esthe-kuchikomi.com/osaka-esthe-guide/"
};
const editorialArticleAvailability = boundary.reviewContentAvailability("editorial-article", formalEditorialSource);
assert.equal(editorialArticleAvailability.status, "available");
assert.equal(editorialArticleAvailability.authority, "wordpress-editorial-post");
assert.equal(
  boundary.reviewContentAvailability("editorial-article", { ...formalEditorialSource, slug: "" }).status,
  "unavailable"
);
assert.equal(
  boundary.reviewContentAvailability("editorial-article", {
    ...formalEditorialSource,
    link: "https://external.example.test/osaka-esthe-guide/"
  }).status,
  "unavailable"
);
assert.equal(boundary.reviewContentAvailability("shop-reply").status, "unavailable");

const links = compileModule("lib/review-links.ts");
assert.equal(links.buildReviewSubmitUrl("fixture-shop"), "/reviews/submit?shop=fixture-shop", "existing shop payload contract must remain unchanged");
assert.equal(links.buildReviewEntryContext({ page: "top" }).scope, "none");
assert.equal(links.buildReviewEntryContext({ page: "hub" }).scope, "none");
const areaContext = links.buildReviewEntryContext({ page: "area", areaSlug: "osaka" });
assert.equal(areaContext.scope, "area");
assert.equal(areaContext.transport, "frontend-only-prefilter");
assert.equal("backendPayload" in areaContext, false);
const shopContext = links.buildReviewEntryContext({ page: "shop", shopSlug: "fixture-shop" });
assert.equal(shopContext.scope, "shop");
assert.equal(shopContext.transport, "existing-shop-query");
assert.equal(shopContext.url, "/reviews/submit?shop=fixture-shop");
assert.equal(links.buildReviewEntryContext({ page: "therapist", therapistName: "表示名だけ" }).scope, "none", "display-name matching must not create therapist context");

console.log("Review experience boundary: PASS");
