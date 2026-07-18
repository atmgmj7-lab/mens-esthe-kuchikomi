import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentProvenanceSource = readFileSync(join(root, "lib/content-provenance.ts"), "utf8");
const contentProvenanceCompiled = ts.transpileModule(contentProvenanceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const contentProvenanceModule = { exports: {} };
vm.runInNewContext(
  contentProvenanceCompiled,
  { module: contentProvenanceModule, exports: contentProvenanceModule.exports, console },
  { filename: "content-provenance.cjs" }
);

const source = readFileSync(join(root, "lib/review-rating.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(
  compiled,
  {
    module,
    exports: module.exports,
    console,
    require: (id) => {
      if (id === "@/lib/content-provenance") return contentProvenanceModule.exports;
      throw new Error(`Unsupported test require: ${id}`);
    }
  },
  { filename: "review-rating.cjs" }
);

const {
  normalizeRatingValue,
  calculateAggregateRating,
  shouldDisplayAggregateRating,
  shouldOutputAggregateRatingSchema,
  resolveShopReviewSummary,
  reviewEligibility
} = module.exports;

const validReview = (rating, overrides = {}) => ({
  sourcePostType: "reviews",
  source: "user",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "承認済みユーザー投稿本文です。",
  authorName: "投稿者A",
  rating,
  ...overrides
});
const editorialReview = (rating) => ({
  sourceType: "editorial-comment",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "編集部コメントです。",
  rating
});
const pendingReview = (rating) => ({
  sourcePostType: "reviews",
  source: "user",
  approvalStatus: "pending",
  status: "pending",
  shopId: 101,
  body: "承認前の投稿本文です。",
  rating
});

const valueCases = [
  [null, "unknown", null],
  [undefined, "unknown", null],
  ["", "unknown", null],
  [" ", "unknown", null],
  [0, "invalid", null],
  ["0", "invalid", null],
  ["4", "valid", 4],
  ["4.0", "valid", 4],
  [4, "valid", 4],
  [4.5, "valid", 4.5],
  ["4.5", "valid", 4.5],
  ["4,5", "valid", 4.5],
  ["星4", "valid", 4],
  ["4点", "valid", 4],
  [Number.NaN, "invalid", null],
  [-1, "invalid", null],
  [6, "invalid", null],
  [100, "invalid", null],
  ["null", "unknown", null],
  ["undefined", "unknown", null],
  [[], "unknown", null],
  [["4"], "valid", 4],
  [["4", "5"], "invalid", null]
];

for (const [input, expectedStatus, expectedValue] of valueCases) {
  const actual = normalizeRatingValue(input);
  assert.equal(actual.status, expectedStatus, `${String(input)} status`);
  assert.equal(actual.value, expectedValue, `${String(input)} value`);
}

const noReviews = calculateAggregateRating([]);
assert.equal(noReviews.displayRating, false);
assert.equal(noReviews.outputSchema, false);

const unknownOrigin = calculateAggregateRating([
  {
    isUserSubmitted: true,
    isApproved: true,
    isPublished: true,
    rating: 5
  }
]);
assert.equal(unknownOrigin.displayRating, false);
assert.equal(unknownOrigin.eligibleReviewCount, 0);
assert.equal(reviewEligibility(validReview(5)).canUseForAggregateRating, true);

const oneReview = calculateAggregateRating([validReview(5)]);
assert.equal(oneReview.displayRating, false);
assert.equal(oneReview.outputSchema, false);
assert.equal(oneReview.eligibleReviewCount, 1);

const twoReviews = calculateAggregateRating([validReview(5), validReview(4)]);
assert.equal(twoReviews.displayRating, false);
assert.equal(twoReviews.outputSchema, false);
assert.equal(twoReviews.eligibleReviewCount, 2);

const threeReviews = calculateAggregateRating([validReview(5), validReview(4), validReview("4.5")]);
assert.equal(threeReviews.displayRating, true);
assert.equal(threeReviews.outputSchema, true);
assert.equal(threeReviews.reviewCount, 3);
assert.equal(threeReviews.ratingValue, 4.5);
assert.equal(shouldDisplayAggregateRating(threeReviews), true);
assert.equal(shouldOutputAggregateRatingSchema(threeReviews), true);

const editorialOnly = calculateAggregateRating([editorialReview(5), editorialReview(4), editorialReview(4)]);
assert.equal(editorialOnly.displayRating, false);
assert.equal(editorialOnly.eligibleReviewCount, 0);

const mixedEditorial = calculateAggregateRating([validReview(5), validReview(4), editorialReview(5)]);
assert.equal(mixedEditorial.displayRating, false);
assert.equal(mixedEditorial.eligibleReviewCount, 2);

const pendingOnly = calculateAggregateRating([pendingReview(5), pendingReview(4), pendingReview(4)]);
assert.equal(pendingOnly.displayRating, false);
assert.equal(pendingOnly.eligibleReviewCount, 0);

const approvedTwoPendingOne = calculateAggregateRating([validReview(5), validReview(4), pendingReview(4)]);
assert.equal(approvedTwoPendingOne.displayRating, false);
assert.equal(approvedTwoPendingOne.eligibleReviewCount, 2);

const noRatingThree = calculateAggregateRating([
  validReview(undefined),
  validReview(undefined),
  validReview(undefined)
]);
assert.equal(noRatingThree.displayRating, false);
assert.equal(noRatingThree.reviewCount, 3);
assert.equal(noRatingThree.eligibleReviewCount, 0);

const twoValidOneNoRating = calculateAggregateRating([
  validReview(5),
  validReview(4),
  validReview(undefined)
]);
assert.equal(twoValidOneNoRating.displayRating, false);
assert.equal(twoValidOneNoRating.reviewCount, 3);
assert.equal(twoValidOneNoRating.eligibleReviewCount, 2);

const fixedAcfSummary = resolveShopReviewSummary({ review_count: 0, review_star: "4.0" });
assert.equal(fixedAcfSummary.reviewCount, 0);
assert.equal(fixedAcfSummary.referenceCount, 0);
assert.equal(fixedAcfSummary.aggregate.displayRating, false);
assert.equal(fixedAcfSummary.aggregate.outputSchema, false);

const countOnlySummary = resolveShopReviewSummary({ review_count: "2", review_star: "4.0" });
assert.equal(countOnlySummary.reviewCount, 0);
assert.equal(countOnlySummary.referenceCount, 2);
assert.equal(countOnlySummary.aggregate.displayRating, false);

const userReviewSummary = resolveShopReviewSummary({
  review_count: "3",
  user_reviews: [validReview(5), validReview(4), validReview("4.5")]
});
assert.equal(userReviewSummary.reviewCount, 3);
assert.equal(userReviewSummary.referenceCount, 3);
assert.equal(userReviewSummary.aggregate.displayRating, true);

const mixedSummary = resolveShopReviewSummary({
  user_reviews: [validReview(5), validReview(4), editorialReview(5), pendingReview(4)]
});
assert.equal(mixedSummary.reviewCount, 2);
assert.equal(mixedSummary.aggregate.displayRating, false);

const componentSource = readFileSync(join(root, "components/common/RatingBadge.tsx"), "utf8");
assert.ok(!componentSource.includes("editor_score"), "RatingBadge must not expose editor score as user rating");

const utilitySource = readFileSync(join(root, "lib/area-shop-utils.ts"), "utf8");
assert.ok(!utilitySource.includes("review_star"), "Public rating display must not use review_star fallback");

const ratingSource = readFileSync(join(root, "lib/review-rating.ts"), "utf8");
assert.ok(ratingSource.includes("@/lib/content-provenance"), "Review rating must use common content provenance");

const rankingSource = readFileSync(join(root, "lib/shop-ranking.ts"), "utf8");
assert.ok(rankingSource.includes("isEligibleForNaturalRanking"), "Natural ranking must exclude PR shops through the shared eligibility helper");
assert.ok(rankingSource.includes("!shop.ranking.isPr"), "Ranking eligibility helper must explicitly exclude PR shops");

const rankingCardsSource = readFileSync(join(root, "components/area/hub/RankingHeroCards.tsx"), "utf8");
assert.ok(rankingCardsSource.includes("canReceiveNaturalRankNumber"), "Ranking cards must not assign natural rank numbers to PR shops");

const seoSource = readFileSync(join(root, "lib/seo.ts"), "utf8");
assert.ok(
  seoSource.includes("reviewModel") && seoSource.includes("aggregateRating"),
  "AggregateRating must use the approved-review view model once the three-response boundary is met"
);
assert.ok(
  !seoSource.match(/aggregateRating[\s\S]{0,500}(?:review_star|review_count)/),
  "AggregateRating must not use legacy ACF review values"
);

console.log("Review rating check passed.");
