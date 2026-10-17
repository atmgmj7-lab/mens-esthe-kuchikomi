import type { PartnerWorkspaceIdentity } from "@/lib/partner/partner-dashboard";

export type PartnerCanonicalGrowthMetrics = Readonly<{
  workspaceId: string;
  appShopId: string;
  reviewHandle: string;
  widgetHandle: string;
  submittedReviews: number;
  pendingReviews: number;
  publicReviews: number;
}>;

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
  campaignMetrics: Unavailable;
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

function validMetrics(metrics: PartnerCanonicalGrowthMetrics): boolean {
  return validCount(metrics.submittedReviews)
    && validCount(metrics.pendingReviews)
    && validCount(metrics.publicReviews)
    && metrics.pendingReviews <= metrics.submittedReviews
    && metrics.publicReviews <= metrics.submittedReviews;
}

function growthCenterAsset(
  metrics: PartnerCanonicalGrowthMetrics | null,
  key: GrowthCenterAssetKey,
  title: string,
  distribution: string,
  toValue: (metrics: PartnerCanonicalGrowthMetrics) => string | null,
): PartnerReviewGrowthCenter["assets"][number] {
  if (metrics === null) {
    return { key, title, distribution, status: "unavailable", message: "口コミ導線のデータを現在確認できません。", prerequisite: "時間をおいて再度確認してください。" };
  }
  const value = toValue(metrics);
  return value === null
    ? { key, title, distribution, status: "misconfigured", message: "このご案内の設定を確認できません。", prerequisite: "運営へお問い合わせください。" }
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
  metrics: PartnerCanonicalGrowthMetrics | null,
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

  if (metrics.workspaceId !== identity.workspaceId || metrics.appShopId !== identity.appShopId || !validMetrics(metrics)) {
    return { status: "forbidden" };
  }

  const reviewUrl = canonicalReviewUrl(metrics.reviewHandle);
  const widget = widgetUrl(metrics.widgetHandle);
  if (!reviewUrl || !widget) return { status: "forbidden" };

  return {
    status: "allowed",
    reviewUrl: { status: "available", value: reviewUrl },
    qr: { status: "available", value: reviewUrl },
    lineMessage: { status: "available", value: lineMessage(reviewUrl) },
    websiteCta: { status: "available", value: websiteCta(reviewUrl) },
    widgetUrl: { status: "available", value: widget },
    reviewMetrics: {
      status: "available",
      submitted: metrics.submittedReviews,
      pending: metrics.pendingReviews,
      published: metrics.publicReviews,
    },
    campaignMetrics: unavailable(),
  };
}

/**
 * Safe, server-derived operational projection for the Growth Center. It does
 * not receive a workspace, shop, or token from the browser and never creates
 * or changes a campaign while rendering.
 */
export function resolvePartnerReviewGrowthCenter(
  identity: PartnerWorkspaceIdentity,
  metrics: PartnerCanonicalGrowthMetrics | null,
): PartnerReviewGrowthCenterResult {
  if (metrics !== null && (metrics.workspaceId !== identity.workspaceId || metrics.appShopId !== identity.appShopId || !validMetrics(metrics))) {
    return { status: "forbidden" };
  }
  return {
    status: "allowed",
    context: { shopName: identity.shopName, canonicalUrl: identity.canonicalUrl },
    assets: [
      growthCenterAsset(metrics, "review_url", "口コミURL", "お客様へ直接案内", (value) => canonicalReviewUrl(value.reviewHandle)),
      growthCenterAsset(metrics, "qr", "店頭QR", "店頭・会計後に案内", (value) => canonicalReviewUrl(value.reviewHandle)),
      growthCenterAsset(metrics, "line", "LINE案内文", "来店後のメッセージで案内", (value) => { const url = canonicalReviewUrl(value.reviewHandle); return url ? lineMessage(url) : null; }),
      growthCenterAsset(metrics, "website_cta", "Webサイト用CTA", "店舗サイトに掲載", (value) => { const url = canonicalReviewUrl(value.reviewHandle); return url ? websiteCta(url) : null; }),
      growthCenterAsset(metrics, "widget", "口コミWidget", "店舗サイトに任意で設置", (value) => widgetUrl(value.widgetHandle)),
    ],
  };
}
