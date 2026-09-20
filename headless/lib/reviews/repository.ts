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

export interface ReviewRepository {
  submit(request: SubmitReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<SubmitReviewResult>>;
  moderate(request: ModerateReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<ModerateReviewResult>>;
  listPublished(request: PublishedReviewRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<readonly PublishedReview[]>>;
  getPublishedMetrics(request: PublishedReviewMetricsRequest, signal?: AbortSignal): Promise<ReviewRepositoryResult<PublishedReviewMetrics>>;
  recordCampaignAttribution(
    request: CampaignReviewAttributionRequest,
    signal?: AbortSignal,
  ): Promise<ReviewRepositoryResult<CampaignReviewAttribution>>;
}
