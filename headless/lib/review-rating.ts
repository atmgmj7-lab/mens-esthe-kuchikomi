import {
  normalizeContentItem,
  normalizeContentItems,
  type ContentProvenanceInput,
  type NormalizedContentItem
} from "@/lib/content-provenance";

export const MIN_REVIEWS_FOR_AGGREGATE_RATING = 3;

export type RatingValueStatus = "valid" | "unknown" | "invalid";

export type NormalizedRatingValue = {
  status: RatingValueStatus;
  value: number | null;
  sourceValue: unknown;
  reason?: string;
};

export type RatingStatus =
  | "eligible"
  | "insufficient-reviews"
  | "no-reviews"
  | "invalid"
  | "unknown";

export type NormalizedAggregateRating = {
  status: RatingStatus;
  ratingValue: number | null;
  reviewCount: number;
  eligibleReviewCount: number;
  displayRating: boolean;
  outputSchema: boolean;
  reason?: string;
};

export type ReviewEligibility = {
  isUserSubmitted: boolean;
  isApproved: boolean;
  isPublished: boolean;
  hasValidRating: boolean;
  hasBody: boolean;
  hasShopReference: boolean;
  isEditorial: boolean;
  isAiGenerated: boolean;
  isPromotion: boolean;
  canDisplayAsUserReview: boolean;
  canUseForAggregateRating: boolean;
};

export type ReviewLike = Partial<ReviewEligibility> & ContentProvenanceInput & {
  rating?: unknown;
  ratingTotal?: unknown;
  rating_total?: unknown;
  status?: unknown;
  approvalStatus?: unknown;
  approval_status?: unknown;
  source?: unknown;
  type?: unknown;
};

export type ShopReviewSummary = {
  reviewCount: number;
  referenceCount: number;
  aggregate: NormalizedAggregateRating;
};

function result(status: RatingValueStatus, value: number | null, sourceValue: unknown, reason: string): NormalizedRatingValue {
  return { status, value, sourceValue, reason };
}

function normalizeRatingText(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ",")
    .trim();
}

function toValidRatingValue(value: number, sourceValue: unknown): NormalizedRatingValue {
  if (Number.isNaN(value)) return result("invalid", null, sourceValue, "nan");
  if (!Number.isFinite(value)) return result("invalid", null, sourceValue, "not-finite");
  if (value <= 0) return result("invalid", null, sourceValue, "zero-or-negative");
  if (value > 5) return result("invalid", null, sourceValue, "out-of-five-point-scale");
  return result("valid", Math.round(value * 10) / 10, sourceValue, "valid-five-point-rating");
}

export function normalizeRatingValue(value: unknown): NormalizedRatingValue {
  if (Array.isArray(value)) {
    if (value.length === 0) return result("unknown", null, value, "empty-array");
    if (value.length === 1) return normalizeRatingValue(value[0]);
    return result("invalid", null, value, "ambiguous-array");
  }

  if (value === null || value === undefined) {
    return result("unknown", null, value, "empty");
  }

  if (typeof value === "number") {
    return toValidRatingValue(value, value);
  }

  if (typeof value !== "string") {
    return result("invalid", null, value, "unsupported-type");
  }

  const raw = normalizeRatingText(value);
  if (!raw) return result("unknown", null, value, "empty");
  if (/^(?:null|undefined|未確認|不明|なし|-|ー|—)$/i.test(raw)) {
    return result("unknown", null, value, "unknown-text");
  }
  if (/^nan$/i.test(raw)) return result("invalid", null, value, "nan-text");

  const decimalText = raw.replace(/^(?:星|評価)?\s*/u, "").replace(/点$/u, "").replace(/,/g, ".");
  const match = decimalText.match(/^\d+(?:\.\d+)?$/);
  if (!match) return result("invalid", null, value, "not-a-rating");

  return toValidRatingValue(Number(match[0]), value);
}

export function reviewEligibility(review: ReviewLike): ReviewEligibility {
  const item = normalizeContentItem(review);
  const rating = normalizeRatingValue(review.rating ?? review.ratingTotal ?? review.rating_total);

  return {
    isUserSubmitted: item.sourceType === "user-review",
    isApproved: item.moderationStatus === "approved",
    isPublished: item.publicationStatus === "published" && item.isPublic,
    hasValidRating: rating.status === "valid",
    hasBody: Boolean(item.body),
    hasShopReference: Boolean(item.shopId),
    isEditorial: item.sourceType === "editorial-comment",
    isAiGenerated: item.sourceType === "ai-generated",
    isPromotion: item.sourceType === "promotion",
    canDisplayAsUserReview: item.canDisplayAsUserReview,
    canUseForAggregateRating: item.canDisplayAsUserReview && rating.status === "valid"
  };
}

export function isEligibleUserReview(review: ReviewLike): boolean {
  const eligibility = reviewEligibility(review);
  return eligibility.canUseForAggregateRating;
}

function normalizedReviewRecords(reviews: ReviewLike[]): Array<{
  review: ReviewLike;
  item: NormalizedContentItem;
}> {
  return reviews.map((review) => ({
    review,
    item: normalizeContentItem(review)
  }));
}

export function calculateAggregateRating(reviews: ReviewLike[]): NormalizedAggregateRating {
  if (reviews.length === 0) {
    return {
      status: "no-reviews",
      ratingValue: null,
      reviewCount: 0,
      eligibleReviewCount: 0,
      displayRating: false,
      outputSchema: false,
      reason: "no-review-records"
    };
  }

  const normalized = normalizedReviewRecords(reviews);
  const displayableUserReviews = normalized.filter(({ item }) => item.canDisplayAsUserReview);
  const eligibleRatings = normalized
    .filter(({ item }) => item.canDisplayAsUserReview)
    .map(({ review }) => normalizeRatingValue(review.rating ?? review.ratingTotal ?? review.rating_total))
    .filter((rating): rating is NormalizedRatingValue & { status: "valid"; value: number } => rating.status === "valid" && rating.value != null);

  if (eligibleRatings.length < MIN_REVIEWS_FOR_AGGREGATE_RATING) {
    return {
      status: eligibleRatings.length === 0 ? "no-reviews" : "insufficient-reviews",
      ratingValue: null,
      reviewCount: displayableUserReviews.length,
      eligibleReviewCount: eligibleRatings.length,
      displayRating: false,
      outputSchema: false,
      reason: "less-than-three-eligible-ratings"
    };
  }

  const sum = eligibleRatings.reduce((total, rating) => total + rating.value, 0);
  const ratingValue = Math.round((sum / eligibleRatings.length) * 10) / 10;

  return {
    status: "eligible",
    ratingValue,
    reviewCount: displayableUserReviews.length,
    eligibleReviewCount: eligibleRatings.length,
    displayRating: true,
    outputSchema: true,
    reason: "eligible-user-reviews"
  };
}

export function shouldDisplayAggregateRating(result: NormalizedAggregateRating): boolean {
  return result.displayRating && result.status === "eligible" && result.ratingValue != null && result.reviewCount >= MIN_REVIEWS_FOR_AGGREGATE_RATING && result.eligibleReviewCount >= MIN_REVIEWS_FOR_AGGREGATE_RATING;
}

export function shouldOutputAggregateRatingSchema(result: NormalizedAggregateRating): boolean {
  return result.outputSchema && shouldDisplayAggregateRating(result);
}

export function parseReviewCount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : 0;
  }
  if (typeof value !== "string") return 0;
  const normalized = normalizeRatingText(value).replace(/[^0-9]/g, "");
  if (!normalized) return 0;
  const count = Number(normalized);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function getReviewRecordsFromAcf(
  acf: Record<string, unknown>,
  context: Partial<ContentProvenanceInput> = {}
): ReviewLike[] {
  if (Array.isArray(acf.user_reviews)) {
    return normalizeContentItems(acf.user_reviews, {
      ...context,
      sourcePostType: "reviews",
      sourceField: "user_reviews"
    }) as ReviewLike[];
  }

  if (Array.isArray(acf.reviews)) {
    return normalizeContentItems(acf.reviews, {
      ...context,
      sourcePostType: "reviews",
      sourceField: "reviews"
    }) as ReviewLike[];
  }

  return [];
}

export function resolveShopReviewSummary(
  acf: Record<string, unknown>,
  context: Partial<ContentProvenanceInput> = {}
): ShopReviewSummary {
  const reportedCount = parseReviewCount(acf.review_count) || parseReviewCount(acf.shop_review_count);
  const reviewRecords = getReviewRecordsFromAcf(acf, context);
  const aggregate = calculateAggregateRating(reviewRecords);
  const reviewCount = reviewRecords.filter((review) => normalizeContentItem(review).canCountAsUserReview).length;

  if (shouldDisplayAggregateRating(aggregate)) {
    return {
      reviewCount,
      referenceCount: reportedCount,
      aggregate
    };
  }

  return {
    reviewCount,
    referenceCount: reportedCount,
    aggregate
  };
}
