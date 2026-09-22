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
  widgetUrl: GrowthKitValue<string>;
  reviewMetrics: Readonly<{ status: "available"; submitted: number; pending: number; published: number }> | Unavailable;
  campaignMetrics: Readonly<{ status: "available"; value: ReadonlyArray<Readonly<{ channel: PartnerReviewCampaignChannel; open: number; conversion: number }>> }> | Unavailable;
}>;

export type PartnerReviewGrowthKitResult = PartnerReviewGrowthKit | Readonly<{ status: "forbidden" }>;

type GrowthCenterAssetKey = "review_url" | "qr" | "line" | "website_cta" | "widget";

export type PartnerReviewGrowthCenter = Readonly<{
  status: "allowed";
  context: Readonly<{ shopName: string; canonicalUrl: string }>;
  assets: ReadonlyArray<
    | Readonly<{ key: GrowthCenterAssetKey; title: string; distribution: string; status: "available"; value: string }>
    | Readonly<{ key: GrowthCenterAssetKey; title: string; distribution: string; status: "unavailable" | "misconfigured"; message: string; prerequisite: string }>
  >;
}>;

export type PartnerReviewGrowthCenterResult = PartnerReviewGrowthCenter | Readonly<{ status: "forbidden" }>;

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

function growthCenterAsset(
  metrics: PartnerReviewGrowthMetrics | null,
  channel: PartnerReviewCampaignChannel,
  key: GrowthCenterAssetKey,
  title: string,
  distribution: string,
  toValue: (campaign: PartnerReviewGrowthCampaignMetrics) => string | null,
): PartnerReviewGrowthCenter["assets"][number] {
  if (metrics === null) {
    return { key, title, distribution, status: "unavailable", message: "口コミ導線のデータを現在確認できません。", prerequisite: "時間をおいて再度確認してください。" };
  }
  const matching = metrics.campaigns.filter((campaign) => campaign.channel === channel);
  const active = matching.filter((campaign) => campaign.isActive);
  if (active.length === 0) {
    return {
      key,
      title,
      distribution,
      status: "unavailable",
      message: matching.length === 0 ? "この導線のCampaignはまだ準備中です。" : "この導線に有効なCampaignがありません。",
      prerequisite: "運営が正しいCampaignを準備または有効化するまでお待ちください。",
    };
  }
  if (active.length !== 1) {
    return { key, title, distribution, status: "misconfigured", message: "この導線に複数の有効なCampaignがあります。", prerequisite: "運営へ設定確認を依頼してください。" };
  }
  const canonical = activeCanonicalCampaign(metrics, channel);
  const value = canonical ? toValue(canonical) : null;
  return value === null
    ? { key, title, distribution, status: "misconfigured", message: "この導線のCampaign設定を確認できません。", prerequisite: "運営へ設定確認を依頼してください。" }
    : { key, title, distribution, status: "available", value };
}

function lineMessage(reviewUrl: string): string {
  return `ご来店後のご感想を、率直にお聞かせください。\n${reviewUrl}`;
}

function websiteCta(reviewUrl: string): string {
  return `<a href="${reviewUrl}">口コミをEskomiで投稿</a>`;
}

function widgetUrl(token: string): string | null {
  return UUID_RE.test(token)
    ? `https://mens-esthe-kuchikomi.com/partner/widget/${token.toLowerCase()}/`
    : null;
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
      widgetUrl: unavailable(),
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
    widgetUrl: websiteCampaign && widgetUrl(websiteCampaign.token)
      ? { status: "available", value: widgetUrl(websiteCampaign.token) as string }
      : unavailable(),
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

/**
 * Safe, server-derived operational projection for the Growth Center. It does
 * not receive a workspace, shop, or token from the browser and never creates
 * or changes a campaign while rendering.
 */
export function resolvePartnerReviewGrowthCenter(
  identity: PartnerWorkspaceIdentity,
  metrics: PartnerReviewGrowthMetrics | null,
): PartnerReviewGrowthCenterResult {
  if (metrics !== null && (metrics.workspaceId !== identity.workspaceId || metrics.shopId !== identity.shopId || !validMetrics(metrics))) {
    return { status: "forbidden" };
  }
  return {
    status: "allowed",
    context: { shopName: identity.shopName, canonicalUrl: identity.canonicalUrl },
    assets: [
      growthCenterAsset(metrics, "counter_qr", "review_url", "口コミURL", "お客様へ直接案内", (campaign) => campaign.reviewUrl),
      growthCenterAsset(metrics, "counter_qr", "qr", "店頭QR", "店頭・会計後に案内", (campaign) => campaign.reviewUrl),
      growthCenterAsset(metrics, "line_after_visit", "line", "LINE案内文", "来店後のメッセージで案内", (campaign) => lineMessage(campaign.reviewUrl)),
      growthCenterAsset(metrics, "shop_website", "website_cta", "Webサイト用CTA", "店舗サイトに掲載", (campaign) => websiteCta(campaign.reviewUrl)),
      growthCenterAsset(metrics, "shop_website", "widget", "口コミWidget", "店舗サイトに任意で設置", (campaign) => widgetUrl(campaign.token)),
    ],
  };
}
