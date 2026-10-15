import "server-only";

import {
  getPartnerReviewGrowthMetrics,
  listPartnerRegistrationReviews,
  type PartnerRegistrationReview,
  type PartnerReviewGrowthMetrics,
} from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { managedShopDirectoryRepository, type ManagedShopLegacyListingState, type ManagedShopNonPublicListingState } from "@/lib/supabase/managed-shop-directory";
import { getAllShopsForListing, getAllWordPressShops, getWordPressShopById } from "@/lib/wp/shops";
import { createOperatorShopFactSnapshot, type OperatorShopFactSnapshot } from "@/lib/dashboard/operator-shop-fact-dry-run";
import { partnerShopFactsRepository, useSupabaseShopManagement } from "@/lib/supabase/partner-shop-facts";
import type { ShopView } from "@/lib/wp/types";

export const OPERATOR_SHOP_PAGE_SIZE = 30;

export type OperatorProjectionStatus = "available" | "not_observed" | "unavailable" | "identity_mismatch";
export type OperatorAssetStatus = "ready" | "not_ready" | "unavailable" | "identity_mismatch";
export type OperatorListingStatus = "listed" | "unlisted" | "deleted";
export type OperatorListingFilter = OperatorListingStatus;

export type OperatorShopRecord = Readonly<{
  publicShop: Readonly<{
    wpShopId: number;
    title: string;
    slug: string;
    canonicalUrl: string;
    managedShopId: string | null;
    officialUrl: string;
    areaName: string | null;
    publicationStatus: string | null;
    listingStatus: OperatorListingStatus;
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
  listingFilter: OperatorListingFilter;
  listingCounts: Readonly<Record<OperatorListingStatus, number>>;
  page: number;
  total: number;
  totalPages: number;
}>;

type OperatorProjectionDependencies = Readonly<{
  listPublicShops: () => Promise<ShopView[]>;
  listWordPressShops: () => Promise<ShopView[]>;
  getShop: (shopId: number) => Promise<ShopView | null>;
  listRegistrations: () => Promise<PartnerRegistrationReview[]>;
  getMetrics: (workspaceId: string) => Promise<PartnerReviewGrowthMetrics | null>;
  listLegacyListingStates: () => Promise<readonly ManagedShopLegacyListingState[]>;
  listNonPublicListingStates: () => Promise<readonly ManagedShopNonPublicListingState[]>;
}>;

const dependencies: OperatorProjectionDependencies = {
  listPublicShops: getAllShopsForListing,
  listWordPressShops: getAllWordPressShops,
  getShop: getWordPressShopById,
  listRegistrations: () => listPartnerRegistrationReviews(partnerReviewGrowthRepository),
  getMetrics: (workspaceId) => getPartnerReviewGrowthMetrics(workspaceId, partnerReviewGrowthRepository),
  listLegacyListingStates: () => managedShopDirectoryRepository.listLegacyListingStates(),
  listNonPublicListingStates: () => managedShopDirectoryRepository.listNonPublicListingStates(),
};

type OperatorProjectionShop = Pick<ShopView, "id" | "publicationStatus" | "slug" | "title" | "officialUrl" | "primaryArea"> & Readonly<{ managedShopId?: string | null }>;

function canonicalUrl(shop: Pick<OperatorProjectionShop, "slug">): string {
  return `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/`;
}

function publicShop(shop: OperatorProjectionShop, listingStatus: OperatorListingStatus): OperatorShopRecord["publicShop"] {
  return {
    wpShopId: shop.id,
    title: shop.title,
    slug: shop.slug,
    canonicalUrl: canonicalUrl(shop),
    managedShopId: shop.managedShopId ?? null,
    officialUrl: shop.officialUrl,
    areaName: shop.primaryArea?.name ?? null,
    publicationStatus: shop.publicationStatus ?? null,
    listingStatus,
  };
}

function normalizedSlug(value: string): string {
  try { return decodeURIComponent(value).toLocaleLowerCase("ja-JP"); } catch { return value.toLocaleLowerCase("ja-JP"); }
}

function listingStatusForShop(
  shop: OperatorProjectionShop,
  listingStates: readonly ManagedShopLegacyListingState[],
): OperatorListingStatus {
  const match = listingStates.find((listingState) => listingState.existing_wp_shop_id === shop.id
    && normalizedSlug(listingState.shop_slug) === normalizedSlug(shop.slug));
  return match?.publication_state ?? "listed";
}

type OperatorListingShop = Readonly<{ shop: OperatorProjectionShop; listingStatus: OperatorListingStatus }>;

function nonPublicManagedShop(state: ManagedShopNonPublicListingState): OperatorProjectionShop {
  return {
    id: state.existing_wp_shop_id ?? state.directory_id,
    managedShopId: state.managed_shop_id,
    publicationStatus: "publish",
    slug: state.shop_slug,
    title: state.shop_name,
    officialUrl: state.official_url ?? "",
    primaryArea: { id: 0, slug: state.area_slug, name: state.area_name },
  };
}

function operatorListingShops(
  publicShops: readonly ShopView[],
  wordPressShops: readonly ShopView[],
  listingStates: readonly ManagedShopLegacyListingState[],
  nonPublicListingStates: readonly ManagedShopNonPublicListingState[],
): OperatorListingShop[] {
  const publicIds = new Set(publicShops.map((shop) => shop.id));
  const visible = publicShops.map((shop) => ({ shop, listingStatus: "listed" as const }));
  const statefulLegacyIds = new Set(nonPublicListingStates.map((state) => state.existing_wp_shop_id).filter((id): id is number => id !== null));
  const legacyNonPublic = wordPressShops
    .filter((shop) => !publicIds.has(shop.id))
    .filter((shop) => !statefulLegacyIds.has(shop.id))
    .map((shop) => ({ shop, listingStatus: listingStatusForShop(shop, listingStates) }))
    .filter(({ listingStatus }) => listingStatus !== "listed");
  const managedNonPublic = nonPublicListingStates.map((state) => {
    const legacy = state.existing_wp_shop_id === null ? null : wordPressShops.find((shop) => shop.id === state.existing_wp_shop_id && normalizedSlug(shop.slug) === normalizedSlug(state.shop_slug));
    return { shop: legacy ?? nonPublicManagedShop(state), listingStatus: state.publication_state };
  });
  return [...visible, ...legacyNonPublic, ...managedNonPublic];
}

function registrationFor(shop: OperatorProjectionShop, registrations: PartnerRegistrationReview[]): PartnerRegistrationReview | null {
  return registrations.find((registration) => registration.shop.id === shop.id) ?? null;
}

function hasSameShopIdentity(
  shop: OperatorProjectionShop,
  registration: PartnerRegistrationReview,
  metrics: PartnerReviewGrowthMetrics | null,
): boolean {
  return registration.shop.id === shop.id
    && registration.shop.slug === shop.slug
    && registration.shop.canonicalUrl === canonicalUrl(shop)
    && (metrics === null || (metrics.workspaceId === registration.workspaceId && metrics.shopId === shop.id));
}

function unavailableRecord(
  shop: OperatorProjectionShop,
  listingStatus: OperatorListingStatus,
  status: Exclude<OperatorProjectionStatus, "available">,
): OperatorShopRecord {
  const assetStatus: OperatorAssetStatus = status === "identity_mismatch" ? "identity_mismatch" : "unavailable";
  return {
    publicShop: publicShop(shop, listingStatus),
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
  shop: OperatorProjectionShop,
  listingStatus: OperatorListingStatus,
  registrations: PartnerRegistrationReview[],
  metrics: PartnerReviewGrowthMetrics | null,
): OperatorShopRecord {
  const registration = registrationFor(shop, registrations);
  if (!registration) return unavailableRecord(shop, listingStatus, "not_observed");
  if (!hasSameShopIdentity(shop, registration, metrics)) return unavailableRecord(shop, listingStatus, "identity_mismatch");

  const activeChannels = registration.campaigns
    .filter((campaign) => campaign.isActive)
    .map((campaign) => campaign.channel);
  const activeChannelSet = new Set(activeChannels);
  const metricStatus: OperatorProjectionStatus = metrics ? "available" : "unavailable";

  return {
    publicShop: publicShop(shop, listingStatus),
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

function normalizeListingFilter(value: string | undefined): OperatorListingFilter {
  return value === "unlisted" || value === "deleted" ? value : "listed";
}

async function metricsByWorkspace(
  registrations: PartnerRegistrationReview[],
  shops: OperatorProjectionShop[],
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
  input: Readonly<{ query?: string; page?: number; listing?: string }>,
  overrides: Partial<OperatorProjectionDependencies> = {},
): Promise<OperatorShopPage> {
  const services = { ...dependencies, ...overrides };
  const [publicShops, wordPressShops, registrations, listingStates, nonPublicListingStates] = await Promise.all([
    services.listPublicShops(), services.listWordPressShops(), services.listRegistrations(), services.listLegacyListingStates(), services.listNonPublicListingStates(),
  ]);
  const query = normalizeQuery(input.query);
  const needle = query.toLocaleLowerCase("ja-JP");
  const queryMatching = operatorListingShops(publicShops, wordPressShops, listingStates, nonPublicListingStates)
    .filter(({ shop }) => !needle || `${shop.title} ${shop.slug} ${shop.primaryArea?.name ?? ""}`.toLocaleLowerCase("ja-JP").includes(needle));
  const listingFilter = normalizeListingFilter(input.listing);
  const listingCounts = {
    listed: queryMatching.filter(({ listingStatus }) => listingStatus === "listed").length,
    unlisted: queryMatching.filter(({ listingStatus }) => listingStatus === "unlisted").length,
    deleted: queryMatching.filter(({ listingStatus }) => listingStatus === "deleted").length,
  } as const;
  const matching = queryMatching.filter(({ listingStatus }) => listingStatus === listingFilter);
  const totalPages = Math.max(1, Math.ceil(matching.length / OPERATOR_SHOP_PAGE_SIZE));
  const page = normalizePage(input.page, totalPages);
  const pageShops = matching.slice((page - 1) * OPERATOR_SHOP_PAGE_SIZE, page * OPERATOR_SHOP_PAGE_SIZE);
  const metrics = await metricsByWorkspace(registrations, pageShops.map(({ shop }) => shop), services.getMetrics);
  return {
    records: pageShops.map(({ shop, listingStatus }) => projectShop(shop, listingStatus, registrations, metrics.get(registrationFor(shop, registrations)?.workspaceId ?? "") ?? null)),
    query,
    listingFilter,
    listingCounts,
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
  const [shop, registrations, listingStates] = await Promise.all([services.getShop(shopId), services.listRegistrations(), services.listLegacyListingStates()]);
  if (!shop) return null;
  const registration = registrationFor(shop, registrations);
  const metrics = registration ? await services.getMetrics(registration.workspaceId) : null;
  return projectShop(shop, listingStatusForShop(shop, listingStates), registrations, metrics);
}

/** Read-only source snapshot for the existing WordPress writer allowlist. */
export async function getOperatorShopFactSnapshot(shopId: number): Promise<OperatorShopFactSnapshot | null> {
  if (!Number.isSafeInteger(shopId) || shopId <= 0) return null;
  if (useSupabaseShopManagement()) {
    if (shopId !== 768) return null;
    const existing = await partnerShopFactsRepository.get(shopId);
    if (existing) return existing;
    // WordPress remains a read-only bootstrap source only when the private
    // Supabase snapshot has not yet been imported for this approved shop.
    const shop = await getWordPressShopById(shopId);
    return shop ? partnerShopFactsRepository.importFromWordPress(createOperatorShopFactSnapshot(shop)) : null;
  }
  const shop = await getWordPressShopById(shopId);
  return shop ? createOperatorShopFactSnapshot(shop) : null;
}
