import type { PartnerMembershipAccess } from "@/lib/partner/partner-auth";
import type { PartnerReviewGrowthKit } from "@/lib/partner/partner-review-growth-kit";

export type PartnerWorkspaceIdentity = Readonly<{
  workspaceId: string;
  shopId: number;
  shopSlug: string;
  shopName: string;
  canonicalUrl: string;
  state: "free_official_partner" | "active_partner";
}>;

export type PartnerDashboardIdentityDependencies = Readonly<{
  getWorkspaceIdentity: (workspaceId: string) => Promise<PartnerWorkspaceIdentity | null>;
}>;

export type PartnerDashboardIdentityResult =
  | Readonly<{ status: "allowed"; identity: PartnerWorkspaceIdentity }>
  | Readonly<{ status: "forbidden" }>;

type PartnerHomePrimaryAction = Readonly<{ label: string; href: string }>;

export type PartnerActionFirstHome = Readonly<{
  context: Readonly<{
    shopName: string;
    partnerStatus: "Free Official Partner" | "Active Partner";
    canonicalUrl: string;
  }>;
  action: Readonly<{
    kind: "review_growth_ready" | "first_review" | "growth_kit_unavailable";
    title: string;
    description: string;
    primaryAction: PartnerHomePrimaryAction;
  }>;
  performance:
    | Readonly<{
        status: "available";
        metrics: ReadonlyArray<Readonly<{
          key: "submitted" | "pending" | "published";
          label: string;
          value: number;
          source: "native_review";
          period: "all_time";
          grain: "workspace_shop";
        }>>;
      }>
    | Readonly<{ status: "unavailable"; message: string }>;
  collection: ReadonlyArray<
    | Readonly<{ key: "review_url" | "qr" | "line" | "website_cta" | "widget"; title: string; status: "available"; value: string }>
    | Readonly<{ key: "review_url" | "qr" | "line" | "website_cta" | "widget"; title: string; status: "unavailable"; message: string }>
  >;
  recentActivity: Readonly<{ status: "unavailable"; message: string }>;
}>;

function isCanonicalIdentity(
  membership: PartnerMembershipAccess,
  identity: PartnerWorkspaceIdentity | null,
): identity is PartnerWorkspaceIdentity {
  return identity !== null
    && identity.workspaceId === membership.workspaceId
    && identity.shopId === membership.shopId
    && identity.shopSlug === membership.shopSlug
    && identity.shopName.trim().length > 0
    && identity.canonicalUrl === `https://mens-esthe-kuchikomi.com/shops/${identity.shopSlug}/`
    && (identity.state === "free_official_partner" || identity.state === "active_partner");
}

export async function resolvePartnerDashboardIdentity(
  membership: PartnerMembershipAccess,
  dependencies: PartnerDashboardIdentityDependencies,
): Promise<PartnerDashboardIdentityResult> {
  try {
    const identity = await dependencies.getWorkspaceIdentity(membership.workspaceId);
    return isCanonicalIdentity(membership, identity)
      ? { status: "allowed", identity }
      : { status: "forbidden" };
  } catch {
    return { status: "forbidden" };
  }
}

function collectionAsset(
  key: "review_url" | "qr" | "line" | "website_cta" | "widget",
  title: string,
  value: { status: "available"; value: string } | { status: "unavailable" },
) {
  return value.status === "available"
    ? { key, title, status: "available" as const, value: value.value }
    : { key, title, status: "unavailable" as const, message: "有効な口コミCampaignを確認できません。" };
}

/**
 * Turns the already-authorized Dashboard identity and Growth Kit into the
 * minimal, side-effect-free Partner Home projection. This function deliberately
 * accepts no workspace or shop identifier from a route or browser.
 */
export function resolvePartnerActionFirstHome(
  identity: PartnerWorkspaceIdentity,
  growthKit: PartnerReviewGrowthKit,
): PartnerActionFirstHome {
  const performance = growthKit.reviewMetrics.status === "available"
    ? {
        status: "available" as const,
        metrics: [
          { key: "submitted" as const, label: "投稿済み", value: growthKit.reviewMetrics.submitted, source: "native_review" as const, period: "all_time" as const, grain: "workspace_shop" as const },
          { key: "pending" as const, label: "審査中", value: growthKit.reviewMetrics.pending, source: "native_review" as const, period: "all_time" as const, grain: "workspace_shop" as const },
          { key: "published" as const, label: "公開済み", value: growthKit.reviewMetrics.published, source: "native_review" as const, period: "all_time" as const, grain: "workspace_shop" as const },
        ],
      }
    : { status: "unavailable" as const, message: "口コミ件数を現在確認できません。" };
  const collection = [
    collectionAsset("review_url", "口コミURL", growthKit.reviewUrl),
    collectionAsset("qr", "QR", growthKit.qr),
    collectionAsset("line", "LINE案内文", growthKit.lineMessage),
    collectionAsset("website_cta", "Webサイト用CTA", growthKit.websiteCta),
    collectionAsset("widget", "口コミWidget", growthKit.widgetUrl),
  ];
  const reviewUrlAvailable = growthKit.reviewUrl.status === "available";
  const firstReview = performance.status === "available" && performance.metrics[0].value === 0;
  const action = !reviewUrlAvailable
    ? {
        kind: "growth_kit_unavailable" as const,
        title: "口コミ導線は準備中です",
        description: "有効な口コミCampaignを確認できないため、口コミURLはまだ利用できません。",
        primaryAction: { label: "公開店舗ページを確認する", href: identity.canonicalUrl },
      }
    : firstReview
      ? {
          kind: "first_review" as const,
          title: "最初の口コミを集めましょう",
          description: "口コミURLを確認し、実際に利用したお客様へ率直な口コミをご案内してください。",
          primaryAction: { label: "口コミURLを確認する", href: "#partner-collect-reviews" },
        }
      : {
          kind: "review_growth_ready" as const,
          title: "口コミを集められます",
          description: "まず口コミURLを確認し、QRやLINEで率直な口コミをご案内してください。",
          primaryAction: { label: "口コミURLを確認する", href: "#partner-collect-reviews" },
        };

  return {
    context: {
      shopName: identity.shopName,
      partnerStatus: identity.state === "free_official_partner" ? "Free Official Partner" : "Active Partner",
      canonicalUrl: identity.canonicalUrl,
    },
    action,
    performance,
    collection,
    recentActivity: {
      status: "unavailable",
      message: "現在、この画面で共有できる最近のアクティビティはありません。口コミの集計をご確認ください。",
    },
  };
}
