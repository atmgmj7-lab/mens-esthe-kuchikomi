import "server-only";

import { classifyShopRelation } from "@/lib/area-shop-utils";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import { resolveVerifiedShopFactProvenance } from "@/lib/shop-information-coverage";
import { buildAreaVerifiedLineComparison } from "@/lib/area-verified-line-comparison";
import type { AreaView, ShopFactProvenance, ShopView } from "@/lib/wp/types";

type OrderingArea = Pick<AreaView, "id" | "slug" | "name">;
const SIGNALS = ["hours", "official", "line", "access"] as const;
type Signal = typeof SIGNALS[number];
const RELATION_PRIORITY = { core: 0, walkable: 0, nearby: 1, related: 2, dispatch: 3, unknown: 4 } as const;

export function isAreaInformationOrderingTarget(area: Pick<AreaView, "id" | "slug">): boolean {
  return (area.id === 13 && area.slug === "shinosaka") || (area.id === 17 && area.slug === "sakai");
}

/** Field evidence, never raw string volume, price, review count or business closing time. */
export function normalizeAreaOrderingFacts(shop: ShopView, area: OrderingArea) {
  const model = buildShopDetailViewModel(shop, area.name);
  const lineVerified = buildAreaVerifiedLineComparison(area, [shop]).length === 1;
  const breakdown = SIGNALS.map((signal) => {
    const field = signal === "line" ? "booking" : signal;
    const evidence = resolveVerifiedShopFactProvenance(field, model, shop.acf.shop_fact_provenance);
    const available = signal === "line" ? lineVerified
      : signal === "official" ? model.actions.some((action) => action.kind === "official")
        : model.infoRows.some((row) => signal === "access"
          ? (row.key === "address" || row.key === "station") && Boolean(row.value)
          : row.key === "hours" && Boolean(row.value));
    const provenance: ShopFactProvenance | null = available && evidence ? evidence : null;
    return {
      signal, verified: provenance !== null, points: provenance ? 1 : 0,
      reason: provenance ? "official-current-value-verified" : "missing-or-unverified-fact",
      provenance,
    };
  });
  const verifiedSignals = breakdown.filter((item) => item.verified).map((item) => item.signal);
  // Only field-level review dates from accepted evidence. No generic post modification time.
  const dates = breakdown.flatMap(({ provenance }) => provenance ? [Date.parse(provenance.reviewedAt)] : []);
  return {
    relation: classifyShopRelation(shop, area),
    totalScore: verifiedSignals.length,
    breakdown,
    eligibleSignals: [...SIGNALS],
    verifiedSignals,
    freshnessTimestamp: dates.length ? Math.max(...dates) : 0,
  };
}

type OrderingFacts = ReturnType<typeof normalizeAreaOrderingFacts>;
type OrderingEntry = OrderingFacts & { shop: ShopView };

function comparison(a: OrderingEntry, b: OrderingEntry): { difference: number; reason: string } {
  const dimensions = [
    { difference: RELATION_PRIORITY[a.relation] - RELATION_PRIORITY[b.relation], reason: "area-relation" },
    { difference: b.totalScore - a.totalScore, reason: "verified-information-count" },
    { difference: b.freshnessTimestamp - a.freshnessTimestamp, reason: "verified-review-date" },
    // Explicit UTF-16 code-unit comparison keeps server/client/runtime locale out of tie-breaking.
    { difference: a.shop.title < b.shop.title ? -1 : a.shop.title > b.shop.title ? 1 : 0, reason: "shop-title" },
    { difference: a.shop.id - b.shop.id, reason: "wp-id" },
  ];
  return dimensions.find(({ difference }) => difference !== 0) ?? { difference: 0, reason: "same-shop" };
}

/** Lexicographic relation > verified count > review date > title > WP ID. PR has a separate display slot. */
export function buildAreaShopOrdering(shops: readonly ShopView[], area: OrderingArea) {
  const entries = shops.filter((shop) => !shop.ranking.isPr)
    .map((shop) => ({ shop, ...normalizeAreaOrderingFacts(shop, area) }))
    .sort((a, b) => comparison(a, b).difference);
  return {
    entries: entries.map((entry, index) => ({
      ...entry,
      tieBreakReason: index === 0 ? "first-in-order" : comparison(entries[index - 1], entry).reason,
    })),
    excludedPrShopIds: shops.filter((shop) => shop.ranking.isPr).map((shop) => shop.id).sort((a, b) => a - b),
  };
}
