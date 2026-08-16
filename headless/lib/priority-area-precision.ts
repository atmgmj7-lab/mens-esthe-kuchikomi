import {
  isBeginnerFriendlyShop,
} from "@/lib/area-shop-utils";
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

const PRIORITY_STATION_FIELDS = ["shop_station", "nearest_station", "station"] as const;
const PRIORITY_WALK_FIELDS = ["shop_walk_minutes", "station_walk_minutes", "walk_minutes"] as const;
const WALK_MINUTES_PATTERN = /徒歩\s*(?:約\s*)?[0-9０-９]+\s*分/u;

export function isPriorityAreaPrecisionTarget(area: Pick<AreaView, "id">): boolean {
  return PRIORITY_AREA_IDS.has(area.id);
}

export function shouldLoadLegacyAreaRanking(area: Pick<AreaView, "id">): boolean {
  return !isPriorityAreaPrecisionTarget(area);
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
  _targetArea: Pick<AreaView, "slug" | "name">,
): PriorityAreaCapabilities {
  return Object.freeze({
    beginner: shops.some(isBeginnerFriendlyShop),
    station: shops.some(hasPriorityStationWalk),
  });
}

function normalizeField(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

export function hasPriorityStationWalk(shop: Pick<ShopView, "acf">): boolean {
  const station = PRIORITY_STATION_FIELDS
    .map((field) => normalizeField(shop.acf[field]))
    .find((value) => /駅/u.test(value));
  if (!station) return false;
  if (WALK_MINUTES_PATTERN.test(station)) return true;

  for (const field of PRIORITY_WALK_FIELDS) {
    const walk = normalizeField(shop.acf[field]);
    if (WALK_MINUTES_PATTERN.test(walk)) return true;
    if (/^[1-9][0-9]*$/u.test(walk)) return true;
  }
  return false;
}
