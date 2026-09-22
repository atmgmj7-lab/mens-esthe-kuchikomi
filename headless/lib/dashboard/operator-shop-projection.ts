import "server-only";

import {
  getPartnerReviewGrowthMetrics,
  listPartnerRegistrationReviews,
  type PartnerRegistrationReview,
  type PartnerReviewGrowthMetrics,
} from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { getAllShopsForListing, getShopById } from "@/lib/wp/shops";
import type { ShopView } from "@/lib/wp/types";

export const OPERATOR_SHOP_PAGE_SIZE = 30;

export type OperatorProjectionStatus = "available" | "not_observed" | "unavailable" | "identity_mismatch";
export type OperatorAssetStatus = "ready" | "not_ready" | "unavailable" | "identity_mismatch";

export type OperatorShopRecord = Readonly<{
  publicShop: Readonly<{
    wpShopId: number;
    title: string;
    slug: string;
    canonicalUrl: string;
    officialUrl: string;
    areaName: string | null;
    publicationStatus: string | null;
  }>;
  partner: Readonly<{
    status: OperatorProjectionStatus;
    workspaceState: string | null;
    registrationStatus: string | null;
    membershipStatus: "not_available" | "not_observed" | "unavailable";
    message: string;
  }>;
  reviews: Readonly<{
    status: OperatorProjectionStatus;
    submitted: number | null;
    pending: number | null;
    published: number | null;
  }>;
  campaigns: Readonly<{
    status: OperatorProjectionStatus;
    activeChannels: ReadonlyArray<"counter_qr" | "line_after_visit" | "shop_website" | "eskomi_shop_page">;
    total: number | null;
  }>;
  assets: Readonly<{
    qr: OperatorAssetStatus;
    line: OperatorAssetStatus;
    websiteCta: OperatorAssetStatus;
    widget: OperatorAssetStatus;
  }>;
}>;

export type OperatorShopPage = Readonly<{
  records: ReadonlyArray<OperatorShopRecord>;
  query: string;
  page: number;
  total: number;
  totalPages: number;
}>;

type OperatorProjectionDependencies = Readonly<{
  listShops: () => Promise<ShopView[]>;
  getShop: (shopId: number) => Promise<ShopView | null>;
  listRegistrations: () => Promise<PartnerRegistrationReview[]>;
  getMetrics: (workspaceId: string) => Promise<PartnerReviewGrowthMetrics | null>;
}>;

const dependencies: OperatorProjectionDependencies = {
  listShops: getAllShopsForListing,
  getShop: getShopById,
  listRegistrations: () => listPartnerRegistrationReviews(partnerReviewGrowthRepository),
  getMetrics: (workspaceId) => getPartnerReviewGrowthMetrics(workspaceId, partnerReviewGrowthRepository),
};

function canonicalUrl(shop: Pick<ShopView, "slug">): string {
  return `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/`;
}

function publicShop(shop: ShopView): OperatorShopRecord["publicShop"] {
  return {
    wpShopId: shop.id,
    title: shop.title,
    slug: shop.slug,
    canonicalUrl: canonicalUrl(shop),
    officialUrl: shop.officialUrl,
    areaName: shop.primaryArea?.name ?? null,
    publicationStatus: shop.publicationStatus ?? null,
  };
}

function registrationFor(shop: ShopView, registrations: PartnerRegistrationReview[]): PartnerRegistrationReview | null {
  return registrations.find((registration) => registration.shop.id === shop.id) ?? null;
}

function hasSameShopIdentity(
  shop: ShopView,
  registration: PartnerRegistrationReview,
  metrics: PartnerReviewGrowthMetrics | null,
): boolean {
  return registration.shop.id === shop.id
    && registration.shop.slug === shop.slug
    && registration.shop.canonicalUrl === canonicalUrl(shop)
    && (metrics === null || (metrics.workspaceId === registration.workspaceId && metrics.shopId === shop.id));
}

function unavailableRecord(shop: ShopView, status: Exclude<OperatorProjectionStatus, "available">): OperatorShopRecord {
  const assetStatus: OperatorAssetStatus = status === "identity_mismatch" ? "identity_mismatch" : "unavailable";
  return {
    publicShop: publicShop(shop),
    partner: {
      status,
      workspaceState: null,
      registrationStatus: null,
      membershipStatus: status === "not_observed" ? "not_observed" : "unavailable",
      message: status === "not_observed"
        ? "安全なOperator投影でPartner申請・Campaignを確認できません。workspace未作成とは断定しません。"
        : status === "identity_mismatch"
          ? "WordPress店舗ID・slug・canonical URLの照合に失敗したため、Partner情報を表示しません。"
          : "Partner運用情報を現在確認できません。",
    },
    reviews: { status, submitted: null, pending: null, published: null },
    campaigns: { status, activeChannels: [], total: null },
    assets: { qr: assetStatus, line: assetStatus, websiteCta: assetStatus, widget: assetStatus },
  };
}

function assetStatus(activeChannels: ReadonlySet<string>, channel: string): OperatorAssetStatus {
  return activeChannels.has(channel) ? "ready" : "not_ready";
}

function projectShop(
  shop: ShopView,
  registrations: PartnerRegistrationReview[],
  metrics: PartnerReviewGrowthMetrics | null,
): OperatorShopRecord {
  const registration = registrationFor(shop, registrations);
  if (!registration) return unavailableRecord(shop, "not_observed");
  if (!hasSameShopIdentity(shop, registration, metrics)) return unavailableRecord(shop, "identity_mismatch");

  const activeChannels = registration.campaigns
    .filter((campaign) => campaign.isActive)
    .map((campaign) => campaign.channel);
  const activeChannelSet = new Set(activeChannels);
  const metricStatus: OperatorProjectionStatus = metrics ? "available" : "unavailable";

  return {
    publicShop: publicShop(shop),
    partner: {
      status: "available",
      workspaceState: registration.workspaceState,
      registrationStatus: registration.status,
      membershipStatus: "not_available",
      message: "Partner状態は service-only の登録投影から表示しています。Membershipの個人情報・識別子は表示しません。",
    },
    reviews: {
      status: metricStatus,
      submitted: metrics?.submittedReviews ?? null,
      pending: metrics?.pendingReviews ?? null,
      published: metrics?.publicReviews ?? null,
    },
    campaigns: {
      status: "available",
      activeChannels,
      total: registration.campaigns.length,
    },
    assets: {
      qr: assetStatus(activeChannelSet, "counter_qr"),
      line: assetStatus(activeChannelSet, "line_after_visit"),
      websiteCta: assetStatus(activeChannelSet, "shop_website"),
      widget: assetStatus(activeChannelSet, "eskomi_shop_page"),
    },
  };
}

function normalizeQuery(value: string | undefined): string {
  return value?.trim().slice(0, 120) ?? "";
}

function normalizePage(value: number | undefined, totalPages: number): number {
  const requested = Number.isSafeInteger(value) ? value as number : 1;
  return Math.min(Math.max(requested, 1), Math.max(totalPages, 1));
}

async function metricsByWorkspace(
  registrations: PartnerRegistrationReview[],
  shops: ShopView[],
  getMetrics: OperatorProjectionDependencies["getMetrics"],
): Promise<Map<string, PartnerReviewGrowthMetrics | null>> {
  const relevant = registrations.filter((registration) => shops.some((shop) => shop.id === registration.shop.id));
  const pairs = await Promise.all(relevant.map(async (registration) => [
    registration.workspaceId,
    await getMetrics(registration.workspaceId),
  ] as const));
  return new Map(pairs);
}

export async function getOperatorShopPage(
  input: Readonly<{ query?: string; page?: number }>,
  overrides: Partial<OperatorProjectionDependencies> = {},
): Promise<OperatorShopPage> {
  const services = { ...dependencies, ...overrides };
  const [shops, registrations] = await Promise.all([services.listShops(), services.listRegistrations()]);
  const query = normalizeQuery(input.query);
  const needle = query.toLocaleLowerCase("ja-JP");
  const matching = needle
    ? shops.filter((shop) => `${shop.title} ${shop.slug} ${shop.primaryArea?.name ?? ""}`.toLocaleLowerCase("ja-JP").includes(needle))
    : shops;
  const totalPages = Math.max(1, Math.ceil(matching.length / OPERATOR_SHOP_PAGE_SIZE));
  const page = normalizePage(input.page, totalPages);
  const pageShops = matching.slice((page - 1) * OPERATOR_SHOP_PAGE_SIZE, page * OPERATOR_SHOP_PAGE_SIZE);
  const metrics = await metricsByWorkspace(registrations, pageShops, services.getMetrics);
  return {
    records: pageShops.map((shop) => projectShop(shop, registrations, metrics.get(registrationFor(shop, registrations)?.workspaceId ?? "") ?? null)),
    query,
    page,
    total: matching.length,
    totalPages,
  };
}

export async function getOperatorShopDetail(
  shopId: number,
  overrides: Partial<OperatorProjectionDependencies> = {},
): Promise<OperatorShopRecord | null> {
  if (!Number.isSafeInteger(shopId) || shopId <= 0) return null;
  const services = { ...dependencies, ...overrides };
  const [shop, registrations] = await Promise.all([services.getShop(shopId), services.listRegistrations()]);
  if (!shop) return null;
  const registration = registrationFor(shop, registrations);
  const metrics = registration ? await services.getMetrics(registration.workspaceId) : null;
  return projectShop(shop, registrations, metrics);
}
