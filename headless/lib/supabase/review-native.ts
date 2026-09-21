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
  PublishReviewRequest,
  ReviewId,
  ReviewMetric,
  ReviewRateLimitClaim,
  ReviewRateLimitClaimRequest,
  ReviewModerationAuditEvent,
  ReviewModerationDetail,
  ReviewModerationQueueItem,
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
  | "claim_review_submission_rate_limit"
  | "submit_review"
  | "submit_review_with_tags"
  | "moderate_review"
  | "publish_review"
  | "list_review_moderation_queue"
  | "get_review_moderation_detail"
  | "list_review_moderation_events"
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

function isShopIdScope(value: readonly number[] | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return value.length <= 500
    && value.every((id) => Number.isSafeInteger(id) && id > 0)
    && new Set(value).size === value.length;
}

function isPublishedScope(
  shop: WordPressShopIdentity | null,
  wpShopIds: readonly number[] | null | undefined,
): boolean {
  return isShopIdentity(shop)
    && isShopIdScope(wpShopIds)
    && !(shop !== null && wpShopIds !== null && wpShopIds !== undefined);
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

function parseModerationQueueRow(value: unknown): ReviewModerationQueueItem | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "review_id", "wp_shop_id", "shop_slug", "shop_name", "body", "submitted_at",
    "rating_total", "rating_price", "rating_service", "rating_cleanliness",
    "visit_period", "revisit_intent", "moderation_status", "publication_status",
    "is_public", "nickname",
  ])) return null;
  if (!isReviewId(value.review_id)
    || !isNonNegativeInteger(value.wp_shop_id) || value.wp_shop_id === 0
    || typeof value.shop_slug !== "string" || !value.shop_slug
    || typeof value.shop_name !== "string" || !value.shop_name
    || typeof value.body !== "string" || !isIsoTimestamp(value.submitted_at)
    || !isRating(value.rating_total) || !isRating(value.rating_price)
    || !isRating(value.rating_service) || !isRating(value.rating_cleanliness)
    || !isNullableString(value.visit_period) || !isNullableString(value.revisit_intent)
    || !["pending", "approved", "rejected", "spam"].includes(String(value.moderation_status))
    || !["draft", "published", "archived"].includes(String(value.publication_status))
    || typeof value.is_public !== "boolean" || typeof value.nickname !== "string") return null;
  return {
    reviewId: value.review_id,
    shop: { wpShopId: value.wp_shop_id, slug: value.shop_slug, name: value.shop_name },
    body: value.body,
    submittedAt: value.submitted_at,
    rating: value.rating_total,
    ratingPrice: value.rating_price,
    ratingService: value.rating_service,
    ratingCleanliness: value.rating_cleanliness,
    visitPeriod: value.visit_period,
    revisitIntent: value.revisit_intent,
    moderationStatus: value.moderation_status as ReviewModerationQueueItem["moderationStatus"],
    publicationStatus: value.publication_status as ReviewModerationQueueItem["publicationStatus"],
    isPublic: value.is_public,
    nickname: value.nickname,
  };
}

function parseModerationDetailRow(value: unknown): ReviewModerationDetail | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "review_id", "wp_shop_id", "shop_slug", "shop_name", "body", "submitted_at",
    "rating_total", "rating_price", "rating_service", "rating_cleanliness",
    "visit_period", "revisit_intent", "moderation_status", "publication_status",
    "is_public", "reviewed_at", "approved_at", "published_at", "nickname", "email",
    "source_url",
  ])) return null;
  const queue = parseModerationQueueRow({
    review_id: value.review_id,
    wp_shop_id: value.wp_shop_id,
    shop_slug: value.shop_slug,
    shop_name: value.shop_name,
    body: value.body,
    submitted_at: value.submitted_at,
    rating_total: value.rating_total,
    rating_price: value.rating_price,
    rating_service: value.rating_service,
    rating_cleanliness: value.rating_cleanliness,
    visit_period: value.visit_period,
    revisit_intent: value.revisit_intent,
    moderation_status: value.moderation_status,
    publication_status: value.publication_status,
    is_public: value.is_public,
    nickname: value.nickname,
  });
  if (!queue || !isNullableTimestamp(value.reviewed_at)
    || !isNullableTimestamp(value.approved_at) || !isNullableTimestamp(value.published_at)
    || !isNullableString(value.email) || typeof value.source_url !== "string") return null;
  return {
    ...queue,
    reviewedAt: value.reviewed_at,
    approvedAt: value.approved_at,
    publishedAt: value.published_at,
    email: value.email,
    sourceUrl: value.source_url,
  };
}

function parseModerationAuditRow(value: unknown): ReviewModerationAuditEvent | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "event_id", "event_type", "from_state", "to_state", "actor_label", "reason", "created_at",
  ]) || !isNonNegativeInteger(value.event_id) || value.event_id === 0
    || !["approved", "rejected", "spam", "published"].includes(String(value.event_type))
    || typeof value.from_state !== "string" || typeof value.to_state !== "string"
    || typeof value.actor_label !== "string" || typeof value.reason !== "string"
    || !isIsoTimestamp(value.created_at)) return null;
  return {
    eventId: value.event_id,
    eventType: value.event_type as ReviewModerationAuditEvent["eventType"],
    fromState: value.from_state,
    toState: value.to_state,
    actorLabel: value.actor_label,
    reason: value.reason,
    createdAt: value.created_at,
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
    "oldest_submitted_at",
    "latest_submitted_at",
  ]) || !isNonNegativeInteger(value.public_approved_review_count)) return null;
  const overall = metric(value.valid_overall_rating_count, value.average_overall_rating);
  const price = metric(value.valid_price_rating_count, value.average_price_rating);
  const service = metric(value.valid_service_rating_count, value.average_service_rating);
  const cleanliness = metric(value.valid_cleanliness_rating_count, value.average_cleanliness_rating);
  if (!overall || !price || !service || !cleanliness
    || overall.responseCount > value.public_approved_review_count
    || price.responseCount > value.public_approved_review_count
    || service.responseCount > value.public_approved_review_count
    || cleanliness.responseCount > value.public_approved_review_count
    || !isNullableTimestamp(value.oldest_submitted_at)
    || !isNullableTimestamp(value.latest_submitted_at)
    || (value.public_approved_review_count === 0
      ? value.oldest_submitted_at !== null || value.latest_submitted_at !== null
      : value.oldest_submitted_at === null || value.latest_submitted_at === null)
    || (value.oldest_submitted_at !== null && value.latest_submitted_at !== null
      && Date.parse(value.oldest_submitted_at) > Date.parse(value.latest_submitted_at))) return null;
  return {
    shop,
    reviewCount: value.public_approved_review_count,
    overall,
    price,
    service,
    cleanliness,
    oldestSubmittedAt: value.oldest_submitted_at,
    latestSubmittedAt: value.latest_submitted_at,
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
    && (request.tags === undefined || (request.tags.length <= 6 && request.tags.every((tag) => typeof tag === "string")))
    && (request.campaignToken === null || isReviewId(request.campaignToken));
}

function parseRateLimitRow(value: unknown): ReviewRateLimitClaim | null {
  if (!isRecord(value) || !hasExactKeys(value, ["allowed", "retry_after_seconds"])
    || typeof value.allowed !== "boolean" || !isNonNegativeInteger(value.retry_after_seconds)) return null;
  return { allowed: value.allowed, retryAfterSeconds: value.retry_after_seconds };
}

function validRateLimitRequest(request: ReviewRateLimitClaimRequest): boolean {
  return SHA256_RE.test(request.idempotencyKeyHash)
    && SHA256_RE.test(request.abuseKeyHash)
    && isIsoTimestamp(request.windowStartedAt)
    && isIsoTimestamp(request.windowExpiresAt)
    && Number.isSafeInteger(request.limit)
    && request.limit >= 1
    && request.limit <= 20;
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
    async claimRateLimit(request, signal) {
      if (!validRateLimitRequest(request)) return error("invalid_request");
      return rpc("claim_review_submission_rate_limit", {
        p_idempotency_key_hash: request.idempotencyKeyHash,
        p_abuse_key_hash: request.abuseKeyHash,
        p_window_started_at: request.windowStartedAt,
        p_window_expires_at: request.windowExpiresAt,
        p_limit: request.limit,
      }, (raw) => parseSingleRow(raw, parseRateLimitRow), signal);
    },

    async submit(request, signal) {
      if (!validSubmitRequest(request)) return error("invalid_request");
      return rpc("submit_review_with_tags", {
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
        p_tags: request.tags ?? [],
      }, (raw) => parseSingleRow(raw, (row) => parseSubmitRow(row, request.shop)), signal);
    },

    async listModerationQueue(request, signal) {
      if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100
        || !Number.isSafeInteger(request.offset) || request.offset < 0) return error("invalid_request");
      return rpc("list_review_moderation_queue", {
        p_limit: request.limit,
        p_offset: request.offset,
      }, (raw) => {
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const rows = raw.map(parseModerationQueueRow);
        return rows.some((row) => row === null) ? null : rows as ReviewModerationQueueItem[];
      }, signal);
    },

    async getModerationDetail(reviewId, signal) {
      if (!isReviewId(reviewId)) return error("invalid_request");
      return rpc("get_review_moderation_detail", { p_review_id: reviewId },
        (raw) => parseSingleRow(raw, parseModerationDetailRow), signal);
    },

    async listModerationAudit(reviewId, signal) {
      if (!isReviewId(reviewId)) return error("invalid_request");
      return rpc("list_review_moderation_events", { p_review_id: reviewId }, (raw) => {
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const rows = raw.map(parseModerationAuditRow);
        return rows.some((row) => row === null) ? null : rows as ReviewModerationAuditEvent[];
      }, signal);
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

    async publish(request: PublishReviewRequest, signal) {
      if (!isReviewId(request.reviewId) || !request.actorLabel || !request.reason) {
        return error("invalid_request");
      }
      return rpc("publish_review", {
        p_review_id: request.reviewId,
        p_actor_label: request.actorLabel,
        p_reason: request.reason,
      }, (raw) => parseSingleRow(raw, parseModerationRow), signal);
    },

    async listPublished(request, signal) {
      if (!isPublishedScope(request.shop, request.wpShopIds)
        || !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100
        || !Number.isSafeInteger(request.offset) || request.offset < 0) return error("invalid_request");
      return rpc("list_published_reviews", {
        p_wp_shop_id: request.shop?.wpShopId ?? null,
        p_wp_shop_ids: request.wpShopIds ?? null,
        p_limit: request.limit,
        p_offset: request.offset,
      }, (raw) => {
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const reviews = raw.map(parsePublishedReview);
        return reviews.some((review) => review === null) ? null : reviews as PublishedReview[];
      }, signal);
    },

    async getPublishedMetrics(request, signal) {
      if (!isPublishedScope(request.shop, request.wpShopIds)) return error("invalid_request");
      return rpc("get_published_review_metrics", {
        p_wp_shop_id: request.shop?.wpShopId ?? null,
        p_wp_shop_ids: request.wpShopIds ?? null,
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
