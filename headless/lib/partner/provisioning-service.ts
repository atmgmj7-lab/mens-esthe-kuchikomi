import "server-only";

import { normalizePublicShopSlug } from "@/lib/shop-slug";

export const PARTNER_WORKSPACE_STATES = [
  "normal_listing",
  "shop_confirmed",
  "free_official_partner",
  "active_partner",
] as const;

export type PartnerWorkspaceState = (typeof PARTNER_WORKSPACE_STATES)[number];

export type CanonicalPartnerShop = {
  id: number;
  slug: string;
  title: string;
};

export type PartnerWorkspace = {
  id: string;
  state: PartnerWorkspaceState;
  initialized: boolean;
};

export const PARTNER_REVIEW_CAMPAIGN_CHANNELS = [
  "counter_qr",
  "line_after_visit",
  "shop_website",
  "eskomi_shop_page",
] as const;

export type PartnerReviewCampaignChannel = (typeof PARTNER_REVIEW_CAMPAIGN_CHANNELS)[number];

export type PartnerReviewCampaign = {
  id: string;
  channel: PartnerReviewCampaignChannel;
  token: string;
  isActive: boolean;
  createdAt: string;
};

export type PartnerReviewCampaignEvent = "open" | "start";

export type PartnerReviewGrowthCampaignMetrics = {
  id: string;
  channel: PartnerReviewCampaignChannel;
  token: string;
  reviewUrl: string;
  isActive: boolean;
  openCount: number;
  startCount: number;
  conversionCount: number;
};

export type PartnerReviewGrowthMetrics = {
  workspaceId: string;
  shopId: number;
  submittedReviews: number;
  pendingReviews: number;
  publicReviews: number;
  campaigns: PartnerReviewGrowthCampaignMetrics[];
};

export type PublicPartnerReviewWidgetCampaign = Readonly<{
  shopId: number;
  shopSlug: string;
  shopName: string;
  canonicalUrl: string;
  reviewUrl: string;
}>;

export type PartnerRegistrationReviewStatus = "received" | "under_review" | "approved" | "rejected";

export type PartnerRegistrationReview = {
  submissionId: string;
  workspaceId: string;
  status: PartnerRegistrationReviewStatus;
  contactName: string;
  contactRole: "owner" | "manager" | "staff" | "authorized_agency";
  contactEmail: string;
  confirmationDetails: string;
  sourceUrl: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewReason: string | null;
  workspaceState: PartnerWorkspaceState;
  shop: CanonicalPartnerShop & { canonicalUrl: string };
  campaigns: PartnerReviewCampaign[];
};

export type PartnerWorkspaceRepository = {
  provision: (input: {
    shopId: number;
    shopSlug: string;
    shopName: string;
    canonicalUrl: string;
    source: "operator" | "self_registration";
  }) => Promise<PartnerWorkspace | null>;
};

export type PartnerReviewGrowthRepository = {
  listRegistrationReviews: () => Promise<PartnerRegistrationReview[]>;
  reviewRegistration: (input: {
    submissionId: string;
    decision: "approved" | "rejected";
    actorLabel: string;
    reason: string;
  }) => Promise<{ state: PartnerWorkspaceState; status: "approved" | "rejected" } | null>;
  openReviewCampaign: (token: string) => Promise<(CanonicalPartnerShop & { canonicalUrl: string }) | null>;
  recordReviewCampaignVisit: (input: {
    token: string;
    event: PartnerReviewCampaignEvent;
  }) => Promise<(CanonicalPartnerShop & { canonicalUrl: string }) | null>;
  getReviewGrowthMetrics: (workspaceId: string) => Promise<PartnerReviewGrowthMetrics | null>;
  getPublicReviewWidget: (token: string) => Promise<PublicPartnerReviewWidgetCampaign | null>;
  recordReviewCampaignSubmission: (input: {
    token: string;
    shopId: number;
    wordpressReviewId: number;
  }, signal?: AbortSignal) => Promise<boolean>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildPartnerReviewCampaignUrl(token: string): string | null {
  return UUID_RE.test(token)
    ? `https://mens-esthe-kuchikomi.com/r/${token.toLowerCase()}/`
    : null;
}

export function nextPartnerAction(state: PartnerWorkspaceState): string {
  switch (state) {
    case "normal_listing": return "店舗の公式申請を受け付け、canonical照合を完了します。";
    case "shop_confirmed": return "運営が申請内容を確認し、無料公式パートナーへの移行を判断します。";
    case "free_official_partner": return "承認済みの手入力ワークフローを開始できます。公開反映は別承認です。";
    case "active_partner": return "承認済みの拡張機能を個別の公開承認フローで利用できます。";
  }
}

export async function provisionPartnerWorkspace(
  shop: CanonicalPartnerShop,
  source: "operator" | "self_registration",
  repository: PartnerWorkspaceRepository,
): Promise<PartnerWorkspace | null> {
  const shopSlug = normalizePublicShopSlug(shop.slug);
  const shopName = shop.title.trim();
  if (!Number.isSafeInteger(shop.id) || shop.id <= 0 || !shopSlug || !shopName || shopName.length > 120) {
    return null;
  }

  return repository.provision({
    shopId: shop.id,
    shopSlug,
    shopName,
    canonicalUrl: `https://mens-esthe-kuchikomi.com/shops/${shopSlug}/`,
    source,
  });
}

export async function listPartnerRegistrationReviews(
  repository: PartnerReviewGrowthRepository,
): Promise<PartnerRegistrationReview[]> {
  try {
    return await repository.listRegistrationReviews();
  } catch {
    return [];
  }
}

export async function reviewPartnerRegistration(
  input: {
    submissionId: string;
    decision: "approved" | "rejected";
    actorLabel: string;
    reason: string;
  },
  repository: PartnerReviewGrowthRepository,
): Promise<{ state: PartnerWorkspaceState; status: "approved" | "rejected" } | null> {
  if (!input.submissionId || !input.actorLabel.trim() || !input.reason.trim()) return null;
  try {
    return await repository.reviewRegistration({
      ...input,
      actorLabel: input.actorLabel.trim(),
      reason: input.reason.trim(),
    });
  } catch {
    return null;
  }
}

export async function openPartnerReviewCampaign(
  token: string,
  repository: PartnerReviewGrowthRepository,
): Promise<(CanonicalPartnerShop & { canonicalUrl: string }) | null> {
  if (!token) return null;
  try {
    return await repository.openReviewCampaign(token);
  } catch {
    return null;
  }
}

export async function recordPartnerReviewCampaignVisit(
  input: { token: string; event: PartnerReviewCampaignEvent },
  repository: PartnerReviewGrowthRepository,
): Promise<(CanonicalPartnerShop & { canonicalUrl: string }) | null> {
  if (!buildPartnerReviewCampaignUrl(input.token)
    || (input.event !== "open" && input.event !== "start")) return null;
  try {
    return await repository.recordReviewCampaignVisit({
      token: input.token.toLowerCase(),
      event: input.event,
    });
  } catch {
    return null;
  }
}

export async function getPartnerReviewGrowthMetrics(
  workspaceId: string,
  repository: PartnerReviewGrowthRepository,
): Promise<PartnerReviewGrowthMetrics | null> {
  if (!UUID_RE.test(workspaceId)) return null;
  try {
    return await repository.getReviewGrowthMetrics(workspaceId.toLowerCase());
  } catch {
    return null;
  }
}

export async function getPublicPartnerReviewWidget(
  token: string,
  repository: PartnerReviewGrowthRepository,
): Promise<PublicPartnerReviewWidgetCampaign | null> {
  if (!buildPartnerReviewCampaignUrl(token)) return null;
  try {
    return await repository.getPublicReviewWidget(token.toLowerCase());
  } catch {
    return null;
  }
}

export async function recordPartnerReviewCampaignSubmission(
  input: { token: string; shopId: number; wordpressReviewId: number },
  repository: PartnerReviewGrowthRepository,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!input.token || !Number.isSafeInteger(input.shopId) || input.shopId <= 0
    || !Number.isSafeInteger(input.wordpressReviewId) || input.wordpressReviewId <= 0) {
    return false;
  }
  try {
    return await repository.recordReviewCampaignSubmission(input, signal);
  } catch {
    return false;
  }
}
