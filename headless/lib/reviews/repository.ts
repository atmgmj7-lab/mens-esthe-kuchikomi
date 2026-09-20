import "server-only";

declare const reviewIdBrand: unique symbol;

export type ReviewId = string & { readonly [reviewIdBrand]: true };

export type WordPressShopIdentity = Readonly<{
  wpShopId: number;
}>;

export type ReviewRepositoryErrorCode =
  | "not_configured"
  | "invalid_request"
  | "request_failed"
  | "invalid_response";

export type ReviewRepositoryResult<T> =
  | Readonly<{ status: "ok"; data: T }>
  | Readonly<{ status: "no_data"; data: null }>
  | Readonly<{ status: "error"; error: Readonly<{ code: ReviewRepositoryErrorCode }> }>;

export type SubmitReviewRequest = Readonly<{
  shop: WordPressShopIdentity;
  body: string;
  rating: number;
  ratingPrice: number | null;
  ratingService: number | null;
  ratingCleanliness: number | null;
  visitPeriod: string | null;
  revisitIntent: string | null;
  nickname: string;
  email: string | null;
  sourceUrl: string;
  idempotencyKeyHash: string;
  abuseKeyHash: string;
  abuseWindowStartedAt: string;
  abuseWindowExpiresAt: string;
  campaignToken: string | null;
}>;

export type SubmitReviewResult = Readonly<{
  reviewId: ReviewId;
  created: boolean;
  shop: WordPressShopIdentity;
}>;

export type ReviewModerationDecision = "approved" | "rejected" | "spam";
export type ReviewModerationStatus = "pending" | ReviewModerationDecision;
export type ReviewPublicationStatus = "draft" | "published" | "archived";

export type ModerateReviewRequest = Readonly<{
  reviewId: ReviewId | string;
  decision: ReviewModerationDecision;
  actorLabel: string;
  reason: string;
}>;

export type ModerateReviewResult = Readonly<{
  reviewId: ReviewId;
  moderationStatus: ReviewModerationStatus;
  publicationStatus: ReviewPublicationStatus;
  isPublic: boolean;
  reviewedAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
}>;

export type ReviewModerationQueueItem = Readonly<{
  reviewId: ReviewId;
  shop: Readonly<{ wpShopId: number; slug: string; name: string }>;
  body: string;
  submittedAt: string;
  rating: number | null;
  ratingPrice: number | null;
  ratingService: number | null;
  ratingCleanliness: number | null;
  visitPeriod: string | null;
  revisitIntent: string | null;
  moderationStatus: ReviewModerationStatus;
  publicationStatus: ReviewPublicationStatus;
  isPublic: boolean;
  nickname: string;
}>;

export type ReviewModerationDetail = ReviewModerationQueueItem & Readonly<{
  reviewedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  email: string | null;
  sourceUrl: string;
}>;

export type ReviewModerationAuditEvent = Readonly<{
  eventId: number;
  eventType: ReviewModerationDecision | "published";
  fromState: string;
  toState: string;
  actorLabel: string;
  reason: string;
  createdAt: string;
}>;

export type PublishReviewRequest = Readonly<{
  reviewId: ReviewId | string;
  actorLabel: string;
  reason: string;
}>;

export type PublishedReview = Readonly<{
  reviewId: ReviewId;
  shop: WordPressShopIdentity;
  body: string;
  submittedAt: string;
  publishedAt: string;
  rating: number | null;
  ratingPrice: number | null;
  ratingService: number | null;
  ratingCleanliness: number | null;
  visitPeriod: string | null;
  revisitIntent: string | null;
}>;

export type PublishedReviewRequest = Readonly<{
  shop: WordPressShopIdentity | null;
  limit: number;
  offset: number;
}>;

export type ReviewMetric = Readonly<{
  responseCount: number;
  average: number | null;
}>;

export type PublishedReviewMetrics = Readonly<{
  shop: WordPressShopIdentity | null;
  reviewCount: number;
  overall: ReviewMetric;
  price: ReviewMetric;
  service: ReviewMetric;
  cleanliness: ReviewMetric;
}>;

export type PublishedReviewMetricsRequest = Readonly<{
  shop: WordPressShopIdentity | null;
}>;

export type CampaignReviewAttributionRequest = Readonly<{
  campaignToken: string;
  reviewId: ReviewId | string;
  shop: WordPressShopIdentity;
}>;

export type CampaignReviewAttribution = Readonly<{
  campaignToken: string;
  reviewId: ReviewId;
  shop: WordPressShopIdentity;
  recorded: boolean;
}>;

export type ReviewRateLimitClaimRequest = Readonly<{
  idempotencyKeyHash: string;
  abuseKeyHash: string;
  windowStartedAt: string;
  windowExpiresAt: string;
  limit: number;
}>;

export type ReviewRateLimitClaim = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

export interface ReviewRepository {
  claimRateLimit(
    request: ReviewRateLimitClaimRequest,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<ReviewRateLimitClaim>>;
  submit(request: SubmitReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<SubmitReviewResult>>;
  listModerationQueue(
    request: Readonly<{ limit: number; offset: number }>,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<readonly ReviewModerationQueueItem[]>>;
  getModerationDetail(
    reviewId: ReviewId | string,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<ReviewModerationDetail>>;
  listModerationAudit(
    reviewId: ReviewId | string,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<readonly ReviewModerationAuditEvent[]>>;
  moderate(request: ModerateReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<ModerateReviewResult>>;
  publish(request: PublishReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<ModerateReviewResult>>;
  listPublished(request: PublishedReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<readonly PublishedReview[]>>;
  getPublishedMetrics(request: PublishedReviewMetricsRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<PublishedReviewMetrics>>;
  recordCampaignAttribution(
    request: CampaignReviewAttributionRequest,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<CampaignReviewAttribution>>;
}
