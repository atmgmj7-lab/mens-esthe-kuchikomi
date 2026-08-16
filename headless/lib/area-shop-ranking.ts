import { sortShopsForRanking } from "@/lib/shop-ranking";
import type { AreaView, ShopView } from "@/lib/wp/types";

export type AreaShopRankingEntry = {
  rank: number;
  shopSlug: string;
};

export type AreaShopRankingMap = Record<string, AreaShopRankingEntry[]>;

function normalizeSlug(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function canDisplayAreaShopRank(shop: ShopView): boolean {
  return !shop.ranking.isPr && shop.ranking.promotion.canReceiveNaturalRankNumber;
}

export function normalizeAreaShopRankingEntries(value: unknown): AreaShopRankingEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((item, index) => {
      const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const shopSlug = normalizeSlug(entry.shopSlug ?? entry.shop_slug ?? entry.slug);
      const rawRank = Number(entry.rank ?? index + 1);
      return {
        rank: Number.isFinite(rawRank) && rawRank > 0 ? Math.floor(rawRank) : index + 1,
        shopSlug
      };
    })
    .filter((entry) => {
      if (!entry.shopSlug || seen.has(entry.shopSlug)) return false;
      seen.add(entry.shopSlug);
      return true;
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function normalizeAreaShopRankingMap(value: unknown): AreaShopRankingMap {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce<AreaShopRankingMap>((acc, [areaSlug, entries]) => {
    const normalizedSlug = normalizeSlug(areaSlug);
    if (!normalizedSlug) return acc;
    const normalizedEntries = normalizeAreaShopRankingEntries(entries);
    if (normalizedEntries.length > 0) {
      acc[normalizedSlug] = normalizedEntries;
    }
    return acc;
  }, {});
}

export function resolveAreaRankingEntries(
  map: AreaShopRankingMap,
  targetArea: Pick<AreaView, "slug">
): AreaShopRankingEntry[] {
  return map[targetArea.slug] ?? [];
}

export function orderShopsForAreaRanking(
  shops: ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">,
  rankingEntries: AreaShopRankingEntry[] = []
): ShopView[] {
  const base = sortShopsForRanking(shops, targetArea);
  const eligible = base.filter(canDisplayAreaShopRank);
  const rest = base.filter((shop) => !canDisplayAreaShopRank(shop));

  if (rankingEntries.length === 0) {
    return [...eligible, ...rest];
  }

  const bySlug = new Map(eligible.map((shop) => [shop.slug.toLowerCase(), shop]));
  const manual = rankingEntries
    .map((entry) => bySlug.get(entry.shopSlug.toLowerCase()))
    .filter((shop): shop is ShopView => Boolean(shop));
  const manualIds = new Set(manual.map((shop) => shop.id));
  const automatic = eligible.filter((shop) => !manualIds.has(shop.id));

  return [...manual, ...automatic, ...rest];
}

export function areaRankForShop(
  shop: ShopView,
  orderedShops: ShopView[],
  maxRank = 5
): number | null {
  if (!canDisplayAreaShopRank(shop)) return null;

  const index = orderedShops.findIndex((item) => item.id === shop.id);
  if (index < 0 || index >= maxRank) return null;
  return index + 1;
}
