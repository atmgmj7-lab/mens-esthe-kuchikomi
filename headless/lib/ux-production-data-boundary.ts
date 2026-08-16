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
  sourceShopId: unknown,
  context: ReviewRelationContext | undefined,
): ReviewRelationView | null {
  if (
    !isPositiveInteger(reviewId) ||
    !isPositiveInteger(sourceShopId) ||
    !context ||
    !isPositiveInteger(context.shopId) ||
    sourceShopId !== context.shopId ||
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
  | "editorial-comment"
  | "editorial-article"
  | "shop-reply";

export type ReviewContentAvailability =
  | {
      status: "available";
      authority:
        | "wordpress-approved-reviews"
        | "wordpress-shop-editorial-field"
        | "wordpress-editorial-post";
    }
  | {
      status: "unavailable";
      reason: "formal-reader-not-configured" | "formal-source-not-configured";
    };

export type EditorialArticleSourceIdentity = {
  wpPostId: number;
  postType: "post" | "article" | "editorial" | "editorial-article";
  slug: string;
  link: string;
};

export type EditorialCommentSourceIdentity = {
  field: "editorial_comment" | "editor_comment" | "shop_editor_comment";
};

export type ReviewContentSourceIdentity =
  | EditorialArticleSourceIdentity
  | EditorialCommentSourceIdentity;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && url.hostname === "mens-esthe-kuchikomi.com"
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function isEditorialArticleSourceIdentity(
  value: unknown,
): value is EditorialArticleSourceIdentity {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<EditorialArticleSourceIdentity>;
  return isPositiveInteger(source.wpPostId)
    && ["post", "article", "editorial", "editorial-article"].includes(source.postType || "")
    && isCanonicalSlug(source.slug)
    && !/[/?#\s]/u.test(source.slug)
    && isHttpUrl(source.link);
}

function isEditorialCommentSourceIdentity(
  value: unknown,
): value is EditorialCommentSourceIdentity {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<EditorialCommentSourceIdentity>;
  return ["editorial_comment", "editor_comment", "shop_editor_comment"].includes(source.field || "");
}

export function reviewContentAvailability(
  kind: ReviewContentKind,
  source?: ReviewContentSourceIdentity,
): ReviewContentAvailability {
  if (kind === "approved-user-review") {
    return { status: "available", authority: "wordpress-approved-reviews" };
  }
  if (kind === "editorial-comment") {
    return isEditorialCommentSourceIdentity(source)
      ? { status: "available", authority: "wordpress-shop-editorial-field" }
      : { status: "unavailable", reason: "formal-source-not-configured" };
  }
  if (kind === "editorial-article") {
    return isEditorialArticleSourceIdentity(source)
      ? { status: "available", authority: "wordpress-editorial-post" }
      : { status: "unavailable", reason: "formal-source-not-configured" };
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
  qa: unavailableReviewCapability(),
  experienceVerified: unavailableReviewCapability(),
} as const;
