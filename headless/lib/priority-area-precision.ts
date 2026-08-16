import {
  isBeginnerFriendlyShop,
  isStationNearShop,
} from "@/lib/area-shop-utils";
import type { AreaShopRankingEntry } from "@/lib/area-shop-ranking";
import type { AreaView, ShopView } from "@/lib/wp/types";

const PRIORITY_AREA_IDS = new Set([17, 13, 7, 46, 4]);

export type PriorityAreaShopGroups = Readonly<{
  exact: readonly ShopView[];
  related: readonly ShopView[];
  unclassified: readonly ShopView[];
  outside: readonly ShopView[];
}>;

export type PriorityAreaCapabilities = Readonly<{
  beginner: boolean;
  station: boolean;
}>;

export type StrictAreaRankedShop = Readonly<{
  shop: ShopView;
  rank: number;
}>;

export function isPriorityAreaPrecisionTarget(area: Pick<AreaView, "id">): boolean {
  return PRIORITY_AREA_IDS.has(area.id);
}

function hasAreaRelation(shop: ShopView, areaId: number): boolean {
  return shop.terms.some((term) => (
    term.id === areaId && (term.taxonomy === undefined || term.taxonomy === "area")
  ));
}

export function classifyPriorityAreaShops(
  shops: readonly ShopView[],
  area: Pick<AreaView, "id">,
): PriorityAreaShopGroups {
  const ids = new Set<number>();
  const exact: ShopView[] = [];
  const related: ShopView[] = [];
  const unclassified: ShopView[] = [];
  const outside: ShopView[] = [];

  for (const shop of shops) {
    if (ids.has(shop.id)) {
      throw new Error(`duplicate canonical WP shop ID: ${shop.id}`);
    }
    ids.add(shop.id);

    if (shop.primaryArea?.id === area.id) {
      exact.push(shop);
      continue;
    }
    if (!hasAreaRelation(shop, area.id)) {
      outside.push(shop);
      continue;
    }
    if (shop.primaryArea === null) {
      unclassified.push(shop);
      continue;
    }
    related.push(shop);
  }

  return Object.freeze({
    exact: Object.freeze(exact),
    related: Object.freeze(related),
    unclassified: Object.freeze(unclassified),
    outside: Object.freeze(outside),
  });
}

export function resolvePriorityAreaCapabilities(
  shops: readonly ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">,
): PriorityAreaCapabilities {
  return Object.freeze({
    beginner: shops.some(isBeginnerFriendlyShop),
    station: shops.some((shop) => isStationNearShop(shop, targetArea)),
  });
}

export function resolveStrictAreaRanking(
  shops: readonly ShopView[],
  entries: readonly AreaShopRankingEntry[],
): readonly StrictAreaRankedShop[] {
  if (entries.length === 0) return Object.freeze([]);

  const shopsBySlug = new Map<string, ShopView>();
  const ambiguousSlugs = new Set<string>();
  for (const shop of shops) {
    const slug = shop.slug.trim().toLowerCase();
    if (!slug) continue;
    if (shopsBySlug.has(slug)) ambiguousSlugs.add(slug);
    shopsBySlug.set(slug, shop);
  }

  const seenSlugs = new Set<string>();
  const seenRanks = new Set<number>();
  const ranked: StrictAreaRankedShop[] = [];
  for (const entry of entries) {
    const slug = entry.shopSlug.trim().toLowerCase();
    if (
      !slug ||
      !Number.isSafeInteger(entry.rank) ||
      entry.rank <= 0 ||
      seenSlugs.has(slug) ||
      seenRanks.has(entry.rank) ||
      ambiguousSlugs.has(slug)
    ) {
      return Object.freeze([]);
    }
    seenSlugs.add(slug);
    seenRanks.add(entry.rank);
    const shop = shopsBySlug.get(slug);
    if (shop) ranked.push(Object.freeze({ shop, rank: entry.rank }));
  }

  return Object.freeze(ranked.sort((left, right) => left.rank - right.rank));
}
