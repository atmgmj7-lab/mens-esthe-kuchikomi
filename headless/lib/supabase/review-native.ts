import "server-only";

import type {
  CampaignReviewAttribution,
  CampaignReviewAttributionRequest,
  ModerateReviewRequest,
  ModerateReviewResult,
  PublishedReview,
  PublishedReviewMetrics,
  PublishedReviewMetricsRequest,
  PublishedReviewRequest,
  ReviewId,
  ReviewMetric,
  ReviewRepository,
  ReviewRepositoryErrorCode,
  ReviewRepositoryResult,
  SubmitReviewRequest,
  SubmitReviewResult,
  WordPressShopIdentity,
} from "@/lib/reviews/repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type ReviewRepositoryConfiguration = Readonly<{
  baseUrl: string | null | undefined;
  serviceRoleKey: string | null | undefined;
  fetchImpl?: typeof fetch;
}>;

type RpcName =
  | "submit_review"
  | "moderate_review"
  | "list_published_reviews"
  | "get_published_review_metrics"
  | "record_partner_review_campaign_review";

function error<T>(code: ReviewRepositoryErrorCode): ReviewRepositoryResult<T> {
  return { status: "error", error: { code } };
}

function noData<T>(): ReviewRepositoryResult<T> {
  return { status: "no_data", data: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function isReviewId(value: unknown): value is ReviewId {
  return typeof value === "string" && UUID_RE.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

function isRating(value: unknown): value is number | null {
  return value === null
    || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isAverage(value: unknown, count: number): value is number | null {
  if (count === 0) return value === null;
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5;
}

function isShopIdentity(value: WordPressShopIdentity | null): boolean {
  return value === null || (Number.isSafeInteger(value.wpShopId) && value.wpShopId > 0);
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:"
      && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if (url.protocol !== "https:" && !localHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function parseSingleRow<T>(value: unknown, parser: (row: unknown) => T | null): T | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  return parser(value[0]);
}

function parseSubmitRow(value: unknown, shop: WordPressShopIdentity): SubmitReviewResult | null {
  if (!isRecord(value) || !hasExactKeys(value, ["review_id", "created"])
    || !isReviewId(value.review_id) || typeof value.created !== "boolean") return null;
  return { reviewId: value.review_id, created: value.created, shop };
}

function parseModerationRow(value: unknown): ModerateReviewResult | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "review_id",
    "moderation_status",
    "publication_status",
    "is_public",
    "reviewed_at",
    "approved_at",
    "published_at",
  ])) return null;
  if (!isReviewId(value.review_id)
    || !["pending", "approved", "rejected", "spam"].includes(String(value.moderation_status))
    || !["draft", "published", "archived"].includes(String(value.publication_status))
    || typeof value.is_public !== "boolean"
    || !isIsoTimestamp(value.reviewed_at)
    || !isNullableTimestamp(value.approved_at)
    || !isNullableTimestamp(value.published_at)) return null;
  return {
    reviewId: value.review_id,
    moderationStatus: value.moderation_status as ModerateReviewResult["moderationStatus"],
    publicationStatus: value.publication_status as ModerateReviewResult["publicationStatus"],
    isPublic: value.is_public,
    reviewedAt: value.reviewed_at,
    approvedAt: value.approved_at,
    publishedAt: value.published_at,
  };
}

function parsePublishedReview(value: unknown): PublishedReview | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "review_id",
    "wp_shop_id",
    "body",
    "submitted_at",
    "published_at",
    "rating_total",
    "rating_price",
    "rating_service",
    "rating_cleanliness",
    "visit_period",
    "revisit_intent",
  ])) return null;
  if (!isReviewId(value.review_id)
    || !isNonNegativeInteger(value.wp_shop_id) || value.wp_shop_id === 0
    || typeof value.body !== "string"
    || !isIsoTimestamp(value.submitted_at) || !isIsoTimestamp(value.published_at)
    || !isRating(value.rating_total) || !isRating(value.rating_price)
    || !isRating(value.rating_service) || !isRating(value.rating_cleanliness)
    || !isNullableString(value.visit_period) || !isNullableString(value.revisit_intent)) return null;
  return {
    reviewId: value.review_id,
    shop: { wpShopId: value.wp_shop_id },
    body: value.body,
    submittedAt: value.submitted_at,
    publishedAt: value.published_at,
    rating: value.rating_total,
    ratingPrice: value.rating_price,
    ratingService: value.rating_service,
    ratingCleanliness: value.rating_cleanliness,
    visitPeriod: value.visit_period,
    revisitIntent: value.revisit_intent,
  };
}

function metric(count: unknown, average: unknown): ReviewMetric | null {
  return isNonNegativeInteger(count) && isAverage(average, count)
    ? { responseCount: count, average }
    : null;
}

function parseMetricsRow(
  value: unknown,
  shop: WordPressShopIdentity | null,
): PublishedReviewMetrics | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "public_approved_review_count",
    "valid_overall_rating_count",
    "average_overall_rating",
    "valid_price_rating_count",
    "average_price_rating",
    "valid_service_rating_count",
    "average_service_rating",
    "valid_cleanliness_rating_count",
    "average_cleanliness_rating",
  ]) || !isNonNegativeInteger(value.public_approved_review_count)) return null;
  const overall = metric(value.valid_overall_rating_count, value.average_overall_rating);
  const price = metric(value.valid_price_rating_count, value.average_price_rating);
  const service = metric(value.valid_service_rating_count, value.average_service_rating);
  const cleanliness = metric(value.valid_cleanliness_rating_count, value.average_cleanliness_rating);
  if (!overall || !price || !service || !cleanliness
    || overall.responseCount > value.public_approved_review_count
    || price.responseCount > value.public_approved_review_count
    || service.responseCount > value.public_approved_review_count
    || cleanliness.responseCount > value.public_approved_review_count) return null;
  return {
    shop,
    reviewCount: value.public_approved_review_count,
    overall,
    price,
    service,
    cleanliness,
  };
}

function validSubmitRequest(request: SubmitReviewRequest): boolean {
  return isShopIdentity(request.shop)
    && typeof request.body === "string"
    && isRating(request.rating) && request.rating !== null
    && isRating(request.ratingPrice) && isRating(request.ratingService) && isRating(request.ratingCleanliness)
    && typeof request.nickname === "string" && typeof request.sourceUrl === "string"
    && isNullableString(request.visitPeriod) && isNullableString(request.revisitIntent)
    && isNullableString(request.email)
    && SHA256_RE.test(request.idempotencyKeyHash) && SHA256_RE.test(request.abuseKeyHash)
    && isIsoTimestamp(request.abuseWindowStartedAt) && isIsoTimestamp(request.abuseWindowExpiresAt)
    && (request.campaignToken === null || isReviewId(request.campaignToken));
}

export function createSupabaseReviewRepository(
  configuration: ReviewRepositoryConfiguration,
): ReviewRepository {
  const baseUrl = normalizeBaseUrl(configuration.baseUrl);
  const serviceRoleKey = configuration.serviceRoleKey || null;
  const fetchImpl = configuration.fetchImpl ?? fetch;

  async function rpc<T>(
    name: RpcName,
    body: Record<string, unknown>,
    parse: (value: unknown) => T | null,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<T>> {
    if (!baseUrl || !serviceRoleKey) return error("not_configured");
    const headers: Record<string, string> = {
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      "Content-Profile": "api",
      "Accept-Profile": "api",
    };
    if (LEGACY_SERVICE_ROLE_JWT_RE.test(serviceRoleKey)) {
      headers.Authorization = `Bearer ${serviceRoleKey}`;
    }
    try {
      const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        cache: "no-store",
        signal,
      });
      if (!response.ok) return error("request_failed");
      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        return error("invalid_response");
      }
      if (Array.isArray(raw) && raw.length === 0) return noData();
      const parsed = parse(raw);
      return parsed === null ? error("invalid_response") : { status: "ok", data: parsed };
    } catch {
      return error("request_failed");
    }
  }

  return {
    async submit(request, signal) {
      if (!validSubmitRequest(request)) return error("invalid_request");
      return rpc("submit_review", {
        p_wp_shop_id: request.shop.wpShopId,
        p_body: request.body,
        p_rating: request.rating,
        p_nickname: request.nickname,
        p_source_url: request.sourceUrl,
        p_idempotency_key_hash: request.idempotencyKeyHash,
        p_abuse_key_hash: request.abuseKeyHash,
        p_abuse_window_started_at: request.abuseWindowStartedAt,
        p_abuse_window_expires_at: request.abuseWindowExpiresAt,
        p_rating_price: request.ratingPrice,
        p_rating_service: request.ratingService,
        p_rating_cleanliness: request.ratingCleanliness,
        p_visit_period: request.visitPeriod,
        p_revisit_intent: request.revisitIntent,
        p_email: request.email,
        p_campaign_token: request.campaignToken,
      }, (raw) => parseSingleRow(raw, (row) => parseSubmitRow(row, request.shop)), signal);
    },

    async moderate(request, signal) {
      if (!isReviewId(request.reviewId)
        || !["approved", "rejected", "spam"].includes(request.decision)
        || !request.actorLabel || !request.reason) return error("invalid_request");
      return rpc("moderate_review", {
        p_review_id: request.reviewId,
        p_decision: request.decision,
        p_actor_label: request.actorLabel,
        p_reason: request.reason,
      }, (raw) => parseSingleRow(raw, parseModerationRow), signal);
    },

    async listPublished(request, signal) {
      if (!isShopIdentity(request.shop)
        || !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100
        || !Number.isSafeInteger(request.offset) || request.offset < 0) return error("invalid_request");
      return rpc("list_published_reviews", {
        p_wp_shop_id: request.shop?.wpShopId ?? null,
        p_limit: request.limit,
        p_offset: request.offset,
      }, (raw) => {
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const reviews = raw.map(parsePublishedReview);
        return reviews.some((review) => review === null) ? null : reviews as PublishedReview[];
      }, signal);
    },

    async getPublishedMetrics(request, signal) {
      if (!isShopIdentity(request.shop)) return error("invalid_request");
      return rpc("get_published_review_metrics", {
        p_wp_shop_id: request.shop?.wpShopId ?? null,
      }, (raw) => parseSingleRow(raw, (row) => parseMetricsRow(row, request.shop)), signal);
    },

    async recordCampaignAttribution(request: CampaignReviewAttributionRequest, signal) {
      if (!isReviewId(request.campaignToken) || !isReviewId(request.reviewId)
        || !isShopIdentity(request.shop)) return error("invalid_request");
      return rpc<CampaignReviewAttribution>("record_partner_review_campaign_review", {
        p_token: request.campaignToken,
        p_wp_shop_id: request.shop.wpShopId,
        p_review_id: request.reviewId,
      }, (raw) => typeof raw === "boolean" ? {
        campaignToken: request.campaignToken,
        reviewId: request.reviewId as ReviewId,
        shop: request.shop,
        recorded: raw,
      } : null, signal);
    },
  };
}

export const reviewNativeRepository = createSupabaseReviewRepository({
  baseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
