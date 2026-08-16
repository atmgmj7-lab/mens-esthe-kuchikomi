import {
  areaRankingScore,
  classifyShopRelation,
  extractShopConfirmedPriceYen,
  hasPublishedPrice,
  isBeginnerFriendlyShop,
  isLateNightShop,
  isStationNearShop,
  shopReviewCount,
  shopUpdatedTimestamp,
  sortShopsForRanking
} from "@/lib/area-shop-utils";
import {
  areaRankForShop,
  orderShopsForAreaRanking,
  type AreaShopRankingEntry
} from "@/lib/area-shop-ranking";
import type { AreaView, ShopView } from "@/lib/wp/types";

export const HUB_SHOP_LIST_INITIAL_COUNT = 12;
export const HUB_SHOP_LIST_LOAD_MORE_COUNT = 12;

export type ShopListFilterId =
  | "late-night"
  | "station"
  | "price"
  | "official"
  | "beginner"
  | "dispatch"
  | "reviews";

export type ShopListSortId = "recommended" | "updated" | "price-asc" | "late-night" | "station";
export type AreaShopListRoute = "hub" | "area" | "shops";
export type ShopListFilterPredicate = (
  shop: ShopView,
  filter: ShopListFilterId,
  targetArea: Pick<AreaView, "slug" | "name">,
) => boolean;

export const SHOP_LIST_FILTER_OPTIONS: Array<{ id: ShopListFilterId; label: string }> = [
  { id: "late-night", label: "深夜営業" },
  { id: "station", label: "駅名・徒歩案内あり" },
  { id: "price", label: "料金掲載あり" },
  { id: "official", label: "公式サイトあり" },
  { id: "beginner", label: "初心者向け" },
  { id: "dispatch", label: "出張対応" },
  { id: "reviews", label: "口コミあり" }
];

export const SHOP_LIST_SORT_OPTIONS: Array<{ id: ShopListSortId; label: string }> = [
  { id: "recommended", label: "おすすめ順" },
  { id: "updated", label: "更新順" },
  { id: "price-asc", label: "料金が安い順" },
  { id: "late-night", label: "深夜営業" },
  { id: "station", label: "駅名・徒歩案内あり" }
];

export function resolveAreaShopListCardRank(
  shop: ShopView,
  orderedShops: ShopView[],
  {
    route,
    sortId = "recommended",
    page = 1
  }: {
    route: AreaShopListRoute;
    sortId?: ShopListSortId;
    page?: number;
  }
): number | null {
  if (route === "shops" || sortId !== "recommended" || page !== 1) return null;
  return areaRankForShop(shop, orderedShops);
}

function isDispatchShop(shop: ShopView, targetArea: Pick<AreaView, "slug" | "name">): boolean {
  return classifyShopRelation(shop, targetArea) === "dispatch";
}

function hasShopReviews(shop: ShopView): boolean {
  return shopReviewCount(shop) > 0;
}

export function matchesShopListFilter(
  shop: ShopView,
  filter: ShopListFilterId,
  targetArea: Pick<AreaView, "slug" | "name">,
): boolean {
  switch (filter) {
    case "late-night":
      return isLateNightShop(shop);
    case "station":
      return isStationNearShop(shop, targetArea);
    case "price":
      return hasPublishedPrice(shop);
    case "official":
      return Boolean(shop.officialUrl);
    case "beginner":
      return isBeginnerFriendlyShop(shop);
    case "dispatch":
      return isDispatchShop(shop, targetArea);
    case "reviews":
      return hasShopReviews(shop);
    default:
      return true;
  }
}

export function matchesShopListFilters(
  shop: ShopView,
  filters: ShopListFilterId[],
  targetArea: Pick<AreaView, "slug" | "name">,
  predicate: ShopListFilterPredicate = matchesShopListFilter,
): boolean {
  if (filters.length === 0) return true;
  return filters.every((filter) => predicate(shop, filter, targetArea));
}

export function filterAreaShops(
  shops: ShopView[],
  filters: ShopListFilterId[],
  targetArea: Pick<AreaView, "slug" | "name">,
  predicate: ShopListFilterPredicate = matchesShopListFilter,
): ShopView[] {
  if (filters.length === 0) return shops;
  return shops.filter((shop) => matchesShopListFilters(shop, filters, targetArea, predicate));
}

export function sortAreaShops(
  shops: ShopView[],
  sortId: ShopListSortId,
  targetArea: Pick<AreaView, "slug" | "name">,
  rankingEntries: AreaShopRankingEntry[] = []
): ShopView[] {
  const list = [...shops];

  switch (sortId) {
    case "recommended":
      return orderShopsForAreaRanking(list, targetArea, rankingEntries);
    case "updated":
      return list.sort((a, b) => shopUpdatedTimestamp(b) - shopUpdatedTimestamp(a));
    case "price-asc":
      return list.sort((a, b) => {
        const aPrice = extractShopConfirmedPriceYen(a);
        const bPrice = extractShopConfirmedPriceYen(b);
        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return aPrice - bPrice;
      });
    case "late-night":
      return list.sort((a, b) => {
        const diff = Number(isLateNightShop(b)) - Number(isLateNightShop(a));
        if (diff !== 0) return diff;
        return areaRankingScore(b, targetArea) - areaRankingScore(a, targetArea);
      });
    case "station":
      return list.sort((a, b) => {
        const diff = Number(isStationNearShop(b, targetArea)) - Number(isStationNearShop(a, targetArea));
        if (diff !== 0) return diff;
        return areaRankingScore(b, targetArea) - areaRankingScore(a, targetArea);
      });
    default:
      return list;
  }
}

export function prepareAreaShopListView(
  shops: ShopView[],
  filters: ShopListFilterId[],
  sortId: ShopListSortId,
  targetArea: Pick<AreaView, "slug" | "name">,
  rankingEntries: AreaShopRankingEntry[] = []
): ShopView[] {
  return sortAreaShops(filterAreaShops(shops, filters, targetArea), sortId, targetArea, rankingEntries);
}

export function getFilterRelaxationSuggestions(
  shops: ShopView[],
  filters: ShopListFilterId[],
  targetArea: Pick<AreaView, "slug" | "name">,
  limit = 3,
  predicate: ShopListFilterPredicate = matchesShopListFilter,
): Array<{ id: ShopListFilterId; label: string; count: number; filters: ShopListFilterId[] }> {
  if (filters.length === 0) return [];

  const activeIds = new Set(filters);
  const activeOptions = SHOP_LIST_FILTER_OPTIONS.filter((option) => activeIds.has(option.id));
  const removeOneSuggestions = activeOptions
    .map((option) => {
      const nextFilters = filters.filter((filter) => filter !== option.id);
      return {
        id: option.id,
        label: `${option.label}を外す`,
        count: filterAreaShops(shops, nextFilters, targetArea, predicate).length,
        filters: nextFilters
      };
    })
    .filter((suggestion) => suggestion.count > 0);

  if (removeOneSuggestions.length > 0) {
    return removeOneSuggestions
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  return activeOptions
    .map((option) => ({
      id: option.id,
      label: `${option.label}だけにする`,
      count: filterAreaShops(shops, [option.id], targetArea, predicate).length,
      filters: [option.id]
    }))
    .filter((suggestion) => suggestion.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
