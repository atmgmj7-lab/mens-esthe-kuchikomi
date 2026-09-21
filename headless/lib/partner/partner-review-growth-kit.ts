import type {
  PartnerReviewCampaignChannel,
  PartnerReviewGrowthCampaignMetrics,
  PartnerReviewGrowthMetrics,
} from "@/lib/partner/provisioning-service";
import type { PartnerWorkspaceIdentity } from "@/lib/partner/partner-dashboard";

type Available<T> = Readonly<{ status: "available"; value: T }>;
type Unavailable = Readonly<{ status: "unavailable" }>;
type GrowthKitValue<T> = Available<T> | Unavailable;

export type PartnerReviewGrowthKit = Readonly<{
  status: "allowed";
  reviewUrl: GrowthKitValue<string>;
  qr: GrowthKitValue<string>;
  lineMessage: GrowthKitValue<string>;
  websiteCta: GrowthKitValue<string>;
  reviewMetrics: Readonly<{ status: "available"; submitted: number; pending: number; published: number }> | Unavailable;
  campaignMetrics: Readonly<{ status: "available"; value: ReadonlyArray<Readonly<{ channel: PartnerReviewCampaignChannel; open: number; conversion: number }>> }> | Unavailable;
}>;

export type PartnerReviewGrowthKitResult = PartnerReviewGrowthKit | Readonly<{ status: "forbidden" }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNELS = ["counter_qr", "line_after_visit", "shop_website", "eskomi_shop_page"] as const;

function unavailable(): Unavailable {
  return { status: "unavailable" };
}

function canonicalReviewUrl(token: string): string | null {
  return UUID_RE.test(token)
    ? `https://mens-esthe-kuchikomi.com/r/${token.toLowerCase()}/`
    : null;
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validMetrics(metrics: PartnerReviewGrowthMetrics): boolean {
  return validCount(metrics.submittedReviews)
    && validCount(metrics.pendingReviews)
    && validCount(metrics.publicReviews)
    && metrics.pendingReviews <= metrics.submittedReviews
    && metrics.publicReviews <= metrics.submittedReviews;
}

function activeCanonicalCampaign(
  metrics: PartnerReviewGrowthMetrics,
  channel: PartnerReviewCampaignChannel,
): PartnerReviewGrowthCampaignMetrics | null {
  const candidates = metrics.campaigns.filter((campaign) => campaign.channel === channel && campaign.isActive);
  if (candidates.length !== 1) return null;
  const campaign = candidates[0];
  const reviewUrl = canonicalReviewUrl(campaign.token);
  return reviewUrl !== null && campaign.reviewUrl === reviewUrl
    && validCount(campaign.openCount) && validCount(campaign.conversionCount)
    ? campaign
    : null;
}

function lineMessage(reviewUrl: string): string {
  return `ご来店後のご感想を、率直にお聞かせください。\n${reviewUrl}`;
}

function websiteCta(reviewUrl: string): string {
  return `<a href="${reviewUrl}">口コミをEskomiで投稿</a>`;
}

export function resolvePartnerReviewGrowthKit(
  identity: PartnerWorkspaceIdentity,
  metrics: PartnerReviewGrowthMetrics | null,
): PartnerReviewGrowthKitResult {
  if (metrics === null) {
    return {
      status: "allowed",
      reviewUrl: unavailable(),
      qr: unavailable(),
      lineMessage: unavailable(),
      websiteCta: unavailable(),
      reviewMetrics: unavailable(),
      campaignMetrics: unavailable(),
    };
  }

  if (metrics.workspaceId !== identity.workspaceId || metrics.shopId !== identity.shopId || !validMetrics(metrics)) {
    return { status: "forbidden" };
  }

  const qrCampaign = activeCanonicalCampaign(metrics, "counter_qr");
  const lineCampaign = activeCanonicalCampaign(metrics, "line_after_visit");
  const websiteCampaign = activeCanonicalCampaign(metrics, "shop_website");
  const campaignMetrics = CHANNELS.flatMap((channel) => {
    const campaign = activeCanonicalCampaign(metrics, channel);
    return campaign ? [{ channel, open: campaign.openCount, conversion: campaign.conversionCount }] : [];
  });

  return {
    status: "allowed",
    reviewUrl: qrCampaign ? { status: "available", value: qrCampaign.reviewUrl } : unavailable(),
    qr: qrCampaign ? { status: "available", value: qrCampaign.reviewUrl } : unavailable(),
    lineMessage: lineCampaign ? { status: "available", value: lineMessage(lineCampaign.reviewUrl) } : unavailable(),
    websiteCta: websiteCampaign ? { status: "available", value: websiteCta(websiteCampaign.reviewUrl) } : unavailable(),
    reviewMetrics: {
      status: "available",
      submitted: metrics.submittedReviews,
      pending: metrics.pendingReviews,
      published: metrics.publicReviews,
    },
    campaignMetrics: campaignMetrics.length > 0
      ? { status: "available", value: campaignMetrics }
      : unavailable(),
  };
}
