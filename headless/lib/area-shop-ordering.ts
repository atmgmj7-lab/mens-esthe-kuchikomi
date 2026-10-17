import "server-only";

import { classifyShopRelation } from "@/lib/area-shop-utils";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import { resolveVerifiedShopFactProvenance } from "@/lib/shop-information-coverage";
import { buildAreaVerifiedLineComparison } from "@/lib/area-verified-line-comparison";
import type { AreaView, ShopFactProvenance, ShopView } from "@/lib/wp/types";

type OrderingArea = Pick<AreaView, "id" | "slug" | "name">;
// R3: price (including duration/add-ons), hours, access, and official contact
// / booking are the only natural-order inputs.  Four fields, no copy/images.
const SIGNALS = ["price", "hours", "access", "officialBooking"] as const;
type Signal = typeof SIGNALS[number];
const RELATION_PRIORITY = { core: 0, walkable: 0, nearby: 1, related: 2, dispatch: 3, unknown: 4 } as const;

export function isAreaInformationOrderingTarget(area: Pick<AreaView, "id" | "slug">): boolean {
  return Boolean(area.slug);
}

/** Field evidence, never raw string volume, price, review count or business closing time. */
export function normalizeAreaOrderingFacts(shop: ShopView, area: OrderingArea) {
  const model = buildShopDetailViewModel(shop, area.name);
  const lineVerified = buildAreaVerifiedLineComparison(area, [shop]).length === 1;
  const verifiedWithin180Days = (value: ShopFactProvenance | null) => value !== null && Date.parse(value.reviewedAt) >= Date.now() - 180 * 24 * 60 * 60 * 1000;
  const breakdown = SIGNALS.map((signal) => {
    const officialEvidence = signal === "officialBooking" ? resolveVerifiedShopFactProvenance("official", model, shop.acf.shop_fact_provenance) : null;
    const bookingEvidence = signal === "officialBooking" ? resolveVerifiedShopFactProvenance("booking", model, shop.acf.shop_fact_provenance) : null;
    const field = signal === "officialBooking" ? (bookingEvidence ? "booking" : "official") : signal;
    const evidence = signal === "officialBooking" ? (bookingEvidence ?? officialEvidence) : resolveVerifiedShopFactProvenance(field, model, shop.acf.shop_fact_provenance);
    const available = signal === "price" ? model.prices.some((course) => course.price.status === "confirmed" && Number.isInteger(course.price.amount) && (course.price.amount ?? 0) > 0)
      : signal === "officialBooking" ? (lineVerified || model.actions.some((action) => action.kind !== "official"))
        : model.infoRows.some((row) => signal === "access"
          ? (row.key === "address" || row.key === "station") && Boolean(row.value)
          : row.key === "hours" && Boolean(row.value));
    const provenance: ShopFactProvenance | null = available && verifiedWithin180Days(evidence) ? evidence : null;
    return {
      signal, verified: provenance !== null, points: provenance ? 1 : 0,
      reason: provenance ? "official-current-value-verified" : "missing-or-unverified-fact",
      provenance,
    };
  });
  const verifiedSignals = breakdown.filter((item) => item.verified).map((item) => item.signal);
  // R4 uses the oldest accepted confirmation, not generic modification time.
  const dates = breakdown.flatMap(({ provenance }) => provenance ? [Date.parse(provenance.reviewedAt)] : []);
  return {
    relation: classifyShopRelation(shop, area),
    totalScore: verifiedSignals.length,
    breakdown,
    eligibleSignals: [...SIGNALS],
    verifiedSignals,
    freshnessTimestamp: dates.length ? Math.min(...dates) : 0,
  };
}

type OrderingFacts = ReturnType<typeof normalizeAreaOrderingFacts>;
type OrderingEntry = OrderingFacts & { shop: ShopView };

function comparison(a: OrderingEntry, b: OrderingEntry): { difference: number; reason: string } {
  const aIdentity = a.shop.canonicalShopId ?? String(a.shop.id).padStart(16, "0");
  const bIdentity = b.shop.canonicalShopId ?? String(b.shop.id).padStart(16, "0");
  const dimensions = [
    { difference: RELATION_PRIORITY[a.relation] - RELATION_PRIORITY[b.relation], reason: "area-relation" },
    { difference: b.totalScore - a.totalScore, reason: "verified-information-count" },
    { difference: b.freshnessTimestamp - a.freshnessTimestamp, reason: "oldest-verified-review-date" },
    // Explicit UTF-16 code-unit comparison keeps server/client/runtime locale out of tie-breaking.
    { difference: a.shop.title < b.shop.title ? -1 : a.shop.title > b.shop.title ? 1 : 0, reason: "shop-title" },
    { difference: aIdentity < bIdentity ? -1 : aIdentity > bIdentity ? 1 : 0, reason: "canonical-shop-id" },
  ];
  return dimensions.find(({ difference }) => difference !== 0) ?? { difference: 0, reason: "same-shop" };
}

/** R1–R4 lexicographic relation > four verified facts > oldest confirmation > normalized name > stable ID. PR has a separate display slot. */
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

/** The reader must pass every eligible candidate here before it cuts a page. */
export function paginateAreaShopInformationOrder(
  shops: readonly ShopView[],
  area: OrderingArea,
  page: number,
  perPage: number,
) {
  const ordered = isAreaInformationOrderingTarget(area)
    ? buildAreaShopOrdering(shops, area).entries.map(({ shop }) => shop)
    : [...shops];
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.max(1, Math.floor(perPage));
  return {
    totalPages: Math.max(1, Math.ceil(ordered.length / safePerPage)),
    shops: ordered.slice((safePage - 1) * safePerPage, safePage * safePerPage),
    ordered,
  };
}
