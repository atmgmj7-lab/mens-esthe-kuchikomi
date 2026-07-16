export type ContentSourceType =
  | "user-review"
  | "editorial-comment"
  | "shop-provided"
  | "shop-description"
  | "ai-generated"
  | "promotion"
  | "unknown";

export type ContentModerationStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "draft"
  | "published"
  | "private"
  | "spam"
  | "unknown";

export type ContentPublicationStatus =
  | "published"
  | "pending"
  | "rejected"
  | "draft"
  | "private"
  | "spam"
  | "unknown";

export type ContentProvenanceInput = {
  id?: unknown;
  shopId?: unknown;
  shop_id?: unknown;
  review_shop_id?: unknown;
  shopSlug?: unknown;
  shop_slug?: unknown;
  body?: unknown;
  content?: unknown;
  contentHtml?: unknown;
  content_html?: unknown;
  reviewBody?: unknown;
  review_body?: unknown;
  authorName?: unknown;
  author_name?: unknown;
  reviewer_name?: unknown;
  author?: unknown;
  authorId?: unknown;
  author_id?: unknown;
  submittedAt?: unknown;
  submitted_at?: unknown;
  date?: unknown;
  rating?: unknown;
  ratingTotal?: unknown;
  rating_total?: unknown;
  sourceType?: unknown;
  source_type?: unknown;
  source?: unknown;
  type?: unknown;
  sourcePostType?: unknown;
  source_post_type?: unknown;
  postType?: unknown;
  post_type?: unknown;
  sourcePostId?: unknown;
  source_post_id?: unknown;
  sourceField?: unknown;
  source_field?: unknown;
  status?: unknown;
  postStatus?: unknown;
  post_status?: unknown;
  wpStatus?: unknown;
  wp_status?: unknown;
  publicationStatus?: unknown;
  publication_status?: unknown;
  moderationStatus?: unknown;
  moderation_status?: unknown;
  approvalStatus?: unknown;
  approval_status?: unknown;
  isPublic?: unknown;
  is_public?: unknown;
  isPublished?: unknown;
  is_published?: unknown;
  isApproved?: unknown;
  is_approved?: unknown;
  isUserSubmitted?: unknown;
  is_user_submitted?: unknown;
  isEditorial?: unknown;
  is_editorial?: unknown;
  isAiGenerated?: unknown;
  is_ai_generated?: unknown;
  isPromotion?: unknown;
  is_promotion?: unknown;
  isPr?: unknown;
  is_pr?: unknown;
  sponsored?: unknown;
  [key: string]: unknown;
};

export type NormalizedContentItem = {
  id: string | null;
  shopId: string | null;
  sourceType: ContentSourceType;
  moderationStatus: ContentModerationStatus;
  publicationStatus: ContentPublicationStatus;
  isPublic: boolean;
  body: string;
  authorName: string | null;
  authorId: string | null;
  submittedAt: string | null;
  rating: unknown;
  sourcePostType: string | null;
  sourcePostId: string | null;
  sourceField: string | null;
  canCountAsUserReview: boolean;
  canDisplayAsUserReview: boolean;
  canUseForAggregateRating: boolean;
  reason: string;
};

const USER_REVIEW_SOURCE_TYPES = new Set(["user-review", "user_review", "user-review"]);
const EDITORIAL_SOURCE_TYPES = new Set(["editorial", "editorial-comment", "editorial_comment"]);
const SHOP_PROVIDED_SOURCE_TYPES = new Set(["shop-provided", "shop_provided", "official", "store-provided"]);
const SHOP_DESCRIPTION_SOURCE_TYPES = new Set(["shop-description", "shop_description", "description"]);
const AI_SOURCE_TYPES = new Set(["ai", "ai-generated", "ai_generated", "generated"]);
const PROMOTION_SOURCE_TYPES = new Set(["promotion", "pr", "sponsored", "ad", "advertisement"]);

const REVIEW_POST_TYPES = new Set(["review", "reviews", "user_review", "user_reviews"]);
const REVIEW_FIELDS = new Set(["reviews", "user_reviews", "review", "review_body", "reviewBody"]);

const FIELD_SOURCE_TYPES: Record<string, ContentSourceType> = {
  shop_ai_summary: "ai-generated",
  ai_summary: "ai-generated",
  generated_summary: "ai-generated",
  editorial_comment: "editorial-comment",
  editor_comment: "editorial-comment",
  shop_editor_comment: "editorial-comment",
  shop_description: "shop-description",
  shop_catch: "shop-description",
  recommend_text: "shop-description",
  content: "shop-description",
  post_content: "shop-description",
  description: "shop-description",
  shop_address: "shop-provided",
  shop_hours: "shop-provided",
  shop_tel: "shop-provided",
  shop_booking: "shop-provided",
  official_url: "shop-provided",
  pr_text: "promotion",
  promotion_text: "promotion",
  sponsored_text: "promotion"
};

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeToken(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textValue(value: unknown): string {
  if (typeof value === "string") return stripHtml(value);
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "rendered" in value) {
    const rendered = (value as { rendered?: unknown }).rendered;
    if (typeof rendered === "string") return stripHtml(rendered);
  }
  return "";
}

function idValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function truthyFlag(value: unknown): boolean {
  const token = normalizeToken(value);
  return value === true || token === "1" || token === "true" || token === "yes" || token === "approved" || token === "published" || token === "publish";
}

function falseyFlag(value: unknown): boolean {
  const token = normalizeToken(value);
  return value === false || token === "0" || token === "false" || token === "no" || token === "rejected" || token === "spam" || token === "trash";
}

export function normalizeModerationStatus(value: unknown): ContentModerationStatus {
  if (value === true) return "approved";
  if (value === false) return "rejected";

  const token = normalizeToken(value);
  if (!token) return "unknown";
  if (token === "approved" || token === "approval-approved") return "approved";
  if (token === "pending" || token === "awaiting-review") return "pending";
  if (token === "rejected" || token === "trash") return "rejected";
  if (token === "draft") return "draft";
  if (token === "publish" || token === "published") return "published";
  if (token === "private") return "private";
  if (token === "spam") return "spam";
  return "unknown";
}

export function normalizePublicationStatus(value: unknown): ContentPublicationStatus {
  if (value === true) return "published";
  if (value === false) return "unknown";

  const token = normalizeToken(value);
  if (!token) return "unknown";
  if (token === "publish" || token === "published" || token === "public") return "published";
  if (token === "pending") return "pending";
  if (token === "rejected" || token === "trash") return "rejected";
  if (token === "draft") return "draft";
  if (token === "private") return "private";
  if (token === "spam") return "spam";
  return "unknown";
}

function explicitSourceType(value: unknown): ContentSourceType | null {
  const token = normalizeToken(value);
  if (!token) return null;
  if (USER_REVIEW_SOURCE_TYPES.has(token)) return "user-review";
  if (EDITORIAL_SOURCE_TYPES.has(token)) return "editorial-comment";
  if (SHOP_PROVIDED_SOURCE_TYPES.has(token)) return "shop-provided";
  if (SHOP_DESCRIPTION_SOURCE_TYPES.has(token)) return "shop-description";
  if (AI_SOURCE_TYPES.has(token)) return "ai-generated";
  if (PROMOTION_SOURCE_TYPES.has(token)) return "promotion";
  return null;
}

function hasUserReviewOrigin(input: ContentProvenanceInput): boolean {
  const sourcePostType = normalizeToken(firstDefined(input.sourcePostType, input.source_post_type, input.postType, input.post_type));
  const sourceField = normalizeToken(firstDefined(input.sourceField, input.source_field));
  return REVIEW_POST_TYPES.has(sourcePostType) || REVIEW_FIELDS.has(sourceField);
}

function resolveSourceType(input: ContentProvenanceInput): ContentSourceType {
  if (truthyFlag(firstDefined(input.isAiGenerated, input.is_ai_generated))) return "ai-generated";
  if (truthyFlag(firstDefined(input.isPromotion, input.is_promotion, input.isPr, input.is_pr, input.sponsored))) return "promotion";
  if (truthyFlag(firstDefined(input.isEditorial, input.is_editorial))) return "editorial-comment";

  const sourceField = textValue(firstDefined(input.sourceField, input.source_field));
  if (sourceField && FIELD_SOURCE_TYPES[sourceField]) {
    return FIELD_SOURCE_TYPES[sourceField];
  }

  const explicit = explicitSourceType(firstDefined(input.sourceType, input.source_type, input.source, input.type));
  if (explicit) return explicit;

  const isUserSubmitted = truthyFlag(firstDefined(input.isUserSubmitted, input.is_user_submitted));
  const source = normalizeToken(firstDefined(input.source, input.type));
  const userSource = source === "user" || source === "user-submitted" || source === "user_review";
  if ((isUserSubmitted || userSource) && hasUserReviewOrigin(input)) {
    return "user-review";
  }

  return "unknown";
}

function resolveReason(item: {
  sourceType: ContentSourceType;
  moderationStatus: ContentModerationStatus;
  publicationStatus: ContentPublicationStatus;
  isPublic: boolean;
  shopId: string | null;
  body: string;
}): string {
  if (item.sourceType !== "user-review") return `source-type-${item.sourceType}`;
  if (item.moderationStatus !== "approved") return `moderation-${item.moderationStatus}`;
  if (item.publicationStatus !== "published") return `publication-${item.publicationStatus}`;
  if (!item.isPublic) return "not-public";
  if (!item.shopId) return "missing-shop-reference";
  if (!item.body) return "missing-body";
  return "eligible-user-review-content";
}

export function normalizeContentItem(input: ContentProvenanceInput): NormalizedContentItem {
  const sourceType = resolveSourceType(input);
  const moderationStatus = normalizeModerationStatus(
    firstDefined(input.moderationStatus, input.moderation_status, input.approvalStatus, input.approval_status, input.isApproved, input.is_approved)
  );
  const publicationStatus = normalizePublicationStatus(
    firstDefined(input.publicationStatus, input.publication_status, input.postStatus, input.post_status, input.wpStatus, input.wp_status, input.status, input.isPublished, input.is_published)
  );
  const isPublic =
    truthyFlag(firstDefined(input.isPublic, input.is_public)) ||
    truthyFlag(firstDefined(input.isPublished, input.is_published)) ||
    publicationStatus === "published";
  const body = textValue(firstDefined(input.body, input.reviewBody, input.review_body, input.content, input.contentHtml, input.content_html));
  const shopId = idValue(firstDefined(input.shopId, input.shop_id, input.review_shop_id, input.shopSlug, input.shop_slug));

  const reason = resolveReason({
    sourceType,
    moderationStatus,
    publicationStatus,
    isPublic,
    shopId,
    body
  });
  const canDisplayAsUserReview = reason === "eligible-user-review-content";

  return {
    id: idValue(input.id),
    shopId,
    sourceType,
    moderationStatus,
    publicationStatus,
    isPublic,
    body,
    authorName: textValue(firstDefined(input.authorName, input.author_name, input.reviewer_name, input.author)) || null,
    authorId: idValue(firstDefined(input.authorId, input.author_id)),
    submittedAt: textValue(firstDefined(input.submittedAt, input.submitted_at, input.date)) || null,
    rating: firstDefined(input.rating, input.ratingTotal, input.rating_total) ?? null,
    sourcePostType: textValue(firstDefined(input.sourcePostType, input.source_post_type, input.postType, input.post_type)) || null,
    sourcePostId: idValue(firstDefined(input.sourcePostId, input.source_post_id)),
    sourceField: sourceFieldValue(input),
    canCountAsUserReview: canDisplayAsUserReview,
    canDisplayAsUserReview,
    canUseForAggregateRating: canDisplayAsUserReview && firstDefined(input.rating, input.ratingTotal, input.rating_total) != null,
    reason
  };
}

function sourceFieldValue(input: ContentProvenanceInput): string | null {
  return textValue(firstDefined(input.sourceField, input.source_field)) || null;
}

export function normalizeContentItems(
  items: unknown,
  context: Partial<ContentProvenanceInput> = {}
): NormalizedContentItem[] {
  if (!Array.isArray(items)) return [];

  const expectedShopId = idValue(
    firstDefined(context.shopId, context.shop_id, context.review_shop_id)
  );

  return items
    .map((item) => {
      const record =
        item && typeof item === "object"
          ? (item as ContentProvenanceInput)
          : ({ body: item } as ContentProvenanceInput);
      return normalizeContentItem({
        ...context,
        ...record,
        shopId: firstDefined(record.shopId, record.shop_id, record.review_shop_id, context.shopId, context.shop_id, context.review_shop_id),
        sourcePostType: firstDefined(record.sourcePostType, record.source_post_type, record.postType, record.post_type, context.sourcePostType, context.source_post_type, context.postType, context.post_type),
        sourceField: firstDefined(record.sourceField, record.source_field, context.sourceField, context.source_field)
      });
    })
    .filter((item) => (
      item.body || item.rating != null || item.sourceType !== "unknown"
    ) && (!expectedShopId || item.shopId === expectedShopId));
}
