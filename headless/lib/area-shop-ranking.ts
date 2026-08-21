import { sortShopsForRanking } from "@/lib/shop-ranking";
import type { AreaView, ShopView } from "@/lib/wp/types";

export type AreaShopRankingEntry = {
  rank: number;
  shopSlug: string;
};

export type AreaShopRankingMap = Record<string, AreaShopRankingEntry[]>;

export type FormalAreaRankingEntry = Readonly<{
  rank: number;
  shopSlug: string;
}>;

export type AreaShopRankingItem = Readonly<{
  rank: number;
  shop: ShopView;
}>;

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

export function resolveFormalAreaRankingItems(
  shops: readonly ShopView[],
  value: readonly unknown[],
): AreaShopRankingItem[] {
  const shopsBySlug = new Map<string, ShopView>();
  const ambiguousSlugs = new Set<string>();
  for (const shop of shops) {
    const slug = normalizeSlug(shop.slug);
    if (!slug || ambiguousSlugs.has(slug)) continue;
    if (shopsBySlug.has(slug)) {
      shopsBySlug.delete(slug);
      ambiguousSlugs.add(slug);
      continue;
    }
    shopsBySlug.set(slug, shop);
  }
  const candidates: FormalAreaRankingEntry[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    const rank = entry.rank;
    const shopSlug = normalizeSlug(entry.shopSlug ?? entry.shop_slug ?? entry.slug);
    if (typeof rank !== "number" || !Number.isSafeInteger(rank) || rank <= 0 || !shopSlug) continue;
    candidates.push(Object.freeze({ rank, shopSlug }));
  }

  const rankCounts = new Map<number, number>();
  const slugCounts = new Map<string, number>();
  for (const candidate of candidates) {
    rankCounts.set(candidate.rank, (rankCounts.get(candidate.rank) ?? 0) + 1);
    slugCounts.set(candidate.shopSlug, (slugCounts.get(candidate.shopSlug) ?? 0) + 1);
  }

  const usedShopIds = new Set<number>();
  const items: AreaShopRankingItem[] = [];

  for (const candidate of candidates) {
    if (rankCounts.get(candidate.rank) !== 1 || slugCounts.get(candidate.shopSlug) !== 1) continue;
    const shop = shopsBySlug.get(candidate.shopSlug);
    if (!shop || usedShopIds.has(shop.id) || !canDisplayAreaShopRank(shop)) continue;

    usedShopIds.add(shop.id);
    items.push(Object.freeze({ rank: candidate.rank, shop }));
  }

  return items.sort((left, right) => left.rank - right.rank);
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
