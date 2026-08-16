export type StrictRankingScope = "overall" | "area" | "shop";

export type StrictRankingUnavailable = {
  status: "unavailable";
  reason: "storage-not-configured";
  scope: StrictRankingScope;
};

export type StrictRankingAvailability = StrictRankingUnavailable;

export function unavailableStrictRanking(
  scope: StrictRankingScope,
): StrictRankingUnavailable {
  return {
    status: "unavailable",
    reason: "storage-not-configured",
    scope,
  };
}

export type ReviewRelationView = {
  reviewId: number;
  shopId: number;
  shopSlug: string;
  areaId: number;
  areaSlug: string;
  therapistId: null;
};

export type ReviewRelationContext = {
  shopId: number;
  shopSlug: string;
  areaId: number;
  areaSlug: string;
};

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isCanonicalSlug(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

export function approvedReviewRelation(
  reviewId: unknown,
  context: ReviewRelationContext | undefined,
): ReviewRelationView | null {
  if (
    !isPositiveInteger(reviewId) ||
    !context ||
    !isPositiveInteger(context.shopId) ||
    !isPositiveInteger(context.areaId) ||
    !isCanonicalSlug(context.shopSlug) ||
    !isCanonicalSlug(context.areaSlug)
  ) {
    return null;
  }

  return {
    reviewId,
    shopId: context.shopId,
    shopSlug: context.shopSlug,
    areaId: context.areaId,
    areaSlug: context.areaSlug,
    therapistId: null,
  };
}

export type ReviewContentKind =
  | "approved-user-review"
  | "editorial-article"
  | "shop-reply";

export type ReviewContentAvailability =
  | { status: "available"; authority: "wordpress-approved-reviews" }
  | { status: "unavailable"; reason: "formal-reader-not-configured" };

export function reviewContentAvailability(
  kind: ReviewContentKind,
): ReviewContentAvailability {
  if (kind === "approved-user-review") {
    return { status: "available", authority: "wordpress-approved-reviews" };
  }
  return { status: "unavailable", reason: "formal-reader-not-configured" };
}

type UnavailableReviewCapability = {
  status: "unavailable";
  reason: "formal-source-not-configured";
};

const unavailableReviewCapability = (): UnavailableReviewCapability => ({
  status: "unavailable",
  reason: "formal-source-not-configured",
});

export const REVIEW_EXPERIENCE_CAPABILITIES = {
  therapistId: unavailableReviewCapability(),
  helpfulCount: unavailableReviewCapability(),
  shopReply: unavailableReviewCapability(),
  experienceVerified: unavailableReviewCapability(),
} as const;
