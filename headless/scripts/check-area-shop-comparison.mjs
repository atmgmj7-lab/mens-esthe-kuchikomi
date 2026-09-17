import assert from "node:assert/strict";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSourceLoader } from "./lib/shop-detail-source-loader.mjs";

const load = createSourceLoader();
function loadPending(path) {
  try {
    return load(resolve(path));
  } catch {
    return {};
  }
}

const stateModule = loadPending("lib/area-shop-comparison-state.ts");
const modelModule = loadPending("lib/area-shop-comparison.ts");
assert.equal(typeof stateModule.reduceAreaShopComparison, "function", "comparison selection reducer must exist");
assert.equal(typeof stateModule.canOpenAreaShopComparison, "function", "comparison readiness helper must exist");
assert.equal(typeof modelModule.buildAreaShopComparisonItems, "function", "comparison ViewModel builder must exist");

const { reduceAreaShopComparison, canOpenAreaShopComparison } = stateModule;
let state = { selectedIds: [], limitReached: false };
state = reduceAreaShopComparison(state, { type: "toggle", shopId: 712 });
assert.deepEqual(Array.from(state.selectedIds), [712]);
assert.equal(canOpenAreaShopComparison(state.selectedIds), false, "one shop cannot open comparison");
state = reduceAreaShopComparison(state, { type: "toggle", shopId: 768 });
assert.deepEqual(Array.from(state.selectedIds), [712, 768]);
assert.equal(canOpenAreaShopComparison(state.selectedIds), true, "two shops enable comparison");
state = reduceAreaShopComparison(state, { type: "toggle", shopId: 900 });
assert.deepEqual(Array.from(state.selectedIds), [712, 768, 900]);
state = reduceAreaShopComparison(state, { type: "toggle", shopId: 901 });
assert.deepEqual(Array.from(state.selectedIds), [712, 768, 900], "fourth shop must not evict an existing selection");
assert.equal(state.limitReached, true, "fourth shop must expose the three-shop limit");
state = reduceAreaShopComparison(state, { type: "remove", shopId: 768 });
assert.deepEqual(Array.from(state.selectedIds), [712, 900]);
assert.equal(state.limitReached, false);
state = reduceAreaShopComparison(state, { type: "toggle", shopId: 712 });
assert.deepEqual(Array.from(state.selectedIds), [900], "the same shop ID toggles once regardless of card location");
state = reduceAreaShopComparison(state, { type: "clear" });
assert.deepEqual(Array.from(state.selectedIds), []);

const { buildShopDetailViewModel } = load(resolve("lib/shop-detail-view-model.ts"));
const { hashShopFactValue } = load(resolve("lib/shop-information-coverage.ts"));
const area = { id: 13, slug: "shinosaka", name: "新大阪" };
const organicPromotion = {
  promotionType: "organic", isPaid: null, requiresDisclosure: false,
  isEligibleForNaturalRanking: true, canReceiveNaturalRankNumber: true,
  disclosureLabel: "", sourceField: null, sourceValue: null,
  outboundRel: "noreferrer", reason: "fixture"
};

function shop(id, overrides = {}) {
  const candidate = {
    id,
    publicationStatus: "publish",
    slug: `shop-${id}`,
    link: "",
    title: `店舗${id}`,
    contentHtml: "",
    excerpt: "",
    imageUrl: "",
    media: { cardSquare: { mediaId: null, source: "fallback", url: "", alt: "" }, detailBanner: null },
    terms: [{ id: area.id, slug: area.slug, name: area.name, parent: 0, taxonomy: "area" }],
    acf: {
      shop_hours: "11:00〜翌5:00",
      shop_station: "新大阪駅 徒歩5分",
      shop_line: `https://line.me/ti/p/@shop${id}`,
      official_url: "https://www.example.com/",
    },
    officialUrl: "https://www.example.com/",
    areaSlug: area.slug,
    primaryArea: { id: area.id, slug: area.slug, name: area.name },
    ranking: { manualRank: null, rankingPriority: null, isRankingEnabled: true, rankingReason: "", isPr: false, rankingLabel: "", promotion: organicPromotion },
    strictRanking: { status: "unavailable", reason: "fixture" },
    ...overrides,
  };
  candidate.acf = { ...candidate.acf, ...(overrides.acf ?? {}) };
  const model = buildShopDetailViewModel(candidate, area.name);
  candidate.acf.shop_fact_provenance = ["hours", "access", "booking", "official"].map((field) => ({
    field,
    sourceType: "official-site",
    sourceUrl: "https://www.example.com/contact/",
    observedAt: "2026-09-16",
    reviewedAt: "2026-09-17",
    reviewStatus: "reviewed",
    publishedValueHash: hashShopFactValue(field, model),
  }));
  return candidate;
}

const untrustedCoverageShop = shop(901, {
  primaryArea: { id: 999, slug: "other", name: "別エリア" },
  acf: { shop_hours: "10:00〜23:00", shop_line: "", shop_station: "", shop_address: "" },
});
untrustedCoverageShop.acf.shop_fact_provenance = untrustedCoverageShop.acf.shop_fact_provenance
  .map((record) => ({ ...record, sourceType: "shop-provided" }));
const shops = [shop(712), shop(768), shop(900), untrustedCoverageShop];
const items = modelModule.buildAreaShopComparisonItems(area, shops);
assert.equal(items.length, 4);
const verified = items.find((item) => item.shopId === 712);
assert.equal(verified.name, "店舗712");
assert.equal(verified.detailUrl, "/shops/shop-712/");
assert.equal(verified.relation.label, "主な掲載エリア");
assert.equal(verified.hours.status, "confirmed");
assert.equal(verified.hours.value, "11:00〜翌5:00");
assert.equal(verified.afterMidnight.status, "confirmed");
assert.equal(verified.afterMidnight.value, "確認済み");
assert.equal(verified.line.status, "confirmed");
assert.equal(verified.official.status, "confirmed");
assert.equal(verified.access.status, "confirmed");
assert.deepEqual({ ...verified.information }, { status: "confirmed", value: "4/4項目確認" });
assert.equal(verified.price.status, "unavailable");
assert.equal(verified.webBooking.status, "unavailable");
assert.equal(verified.reviewedAt, "2026-09-17");

const missing = items.find((item) => item.shopId === 901);
assert.equal(missing.relation.label, "関連掲載エリア");
assert.equal(missing.afterMidnight.status, "unknown");
assert.equal(missing.line.status, "unknown");
assert.equal(missing.access.status, "unknown");
assert.equal(missing.information.status, "unknown");
assert.equal(missing.reviewedAt, null, "untrusted coverage dates must not be published");
assert.equal(JSON.stringify(missing).includes("非対応"), false, "missing facts must never become unsupported claims");
assert.equal(JSON.stringify(items).includes("料金"), false, "price must not enter comparison V1");
assert.equal(JSON.stringify(items).includes("Web予約"), false, "web booking must not enter comparison V1");

const emptyFactsItem = modelModule.buildAreaShopComparisonItems(area, [shop(902, {
  acf: { shop_hours: "", shop_line: "", shop_station: "", shop_address: "" },
})])[0];
assert.deepEqual(
  { ...emptyFactsItem.information },
  { status: "confirmed", value: "1/4項目確認" },
  "strict evidence for empty displayed facts must not inflate the coverage count",
);

const prPromotion = {
  ...organicPromotion,
  promotionType: "paid",
  isPaid: true,
  requiresDisclosure: true,
  isEligibleForNaturalRanking: false,
  canReceiveNaturalRankNumber: false,
  disclosureLabel: "PR",
  outboundRel: "sponsored noreferrer",
};
const prItem = modelModule.buildAreaShopComparisonItems(area, [shop(903, {
  ranking: {
    manualRank: null,
    rankingPriority: null,
    isRankingEnabled: true,
    rankingReason: "",
    isPr: true,
    rankingLabel: "",
    promotion: prPromotion,
  },
})])[0];
assert.equal(prItem.requiresPromotionDisclosure, true, "comparison retains PR disclosure");
assert.match(prItem.official.rel, /sponsored/, "comparison retains promotional outbound rel");

const experienceModule = loadPending("components/area/comparison/AreaShopComparisonExperience.tsx");
assert.equal(typeof experienceModule.AreaShopComparisonProvider, "function", "comparison provider must exist");
assert.equal(typeof experienceModule.AreaShopComparisonToggle, "function", "comparison toggle must exist");
const initialMarkup = renderToStaticMarkup(
  React.createElement(
    experienceModule.AreaShopComparisonProvider,
    { areaName: area.name, items },
    React.createElement(experienceModule.AreaShopComparisonToggle, { shopId: 712, location: "featured" }),
    React.createElement(experienceModule.AreaShopComparisonToggle, { shopId: 712, location: "natural" }),
  ),
);
assert.equal((initialMarkup.match(/data-area-comparison-shop="712"/g) ?? []).length, 2);
assert.equal((initialMarkup.match(/aria-pressed="false"/g) ?? []).length, 2);
assert.match(initialMarkup, /<aside[^>]*hidden=""[^>]*data-area-comparison-launcher="true"/);
assert.match(initialMarkup, /data-area-comparison-dialog="true"/);
assert.equal(initialMarkup.includes("料金"), false, "comparison UI must not expose price V1");
assert.equal(initialMarkup.includes("Web予約"), false, "comparison UI must not expose Web booking V1");

console.log(JSON.stringify({ pass: true, stateCases: 8, modelItems: items.length, initialToggles: 2 }));
