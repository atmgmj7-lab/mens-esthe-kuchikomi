import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

function compileModule(path, requireMap) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText;
  const loaded = { exports: {} };
  const require = (id) => {
    if (id in requireMap) return requireMap[id];
    throw new Error(`Unexpected require from ${path}: ${id}`);
  };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require }, { filename: `${path}.cjs` });
  return loaded.exports;
}

const sharedCardImport = 'import { AreaShopCard } from "@/components/common/AreaShopCard";';
const routeSources = [
  ["six area hubs", read("components/area/hub/AreaShopList.tsx"), "ShopCardLuxury"],
  ["regular area route", read("components/AreaPageView.tsx"), "ShopCard"],
  ["shops route", read("app/shops/page.tsx"), "ShopCard"]
];

for (const [label, source, legacyCard] of routeSources) {
  assert.ok(source.includes(sharedCardImport), `${label} must import the shared AreaShopCard directly`);
  assert.match(source, /<AreaShopCard\b/, `${label} must render the shared AreaShopCard directly`);
  assert.ok(!source.includes(`<${legacyCard}`), `${label} must not render the ${legacyCard} compatibility wrapper`);
}

const hubConfig = read("lib/area-hub-config.ts");
for (const slug of ["sakaisujihonmachi", "shinosaka", "nihonbashi", "nanba", "umeda", "sakai"]) {
  assert.match(hubConfig, new RegExp(`\\b${slug}:\\s*\\{`), `hub contract must retain ${slug}`);
}

const areaShopUtilsStub = {
  areaRankingScore: () => 0,
  classifyShopRelation: () => "direct",
  extractShopConfirmedPriceYen: () => null,
  hasPublishedPrice: () => false,
  isBeginnerFriendlyShop: () => false,
  isLateNightShop: () => false,
  isStationNearShop: () => false,
  shopReviewCount: () => 0,
  shopUpdatedTimestamp: () => 0,
  sortShopsForRanking: (shops) => shops
};
const areaRankingStub = {
  orderShopsForAreaRanking: (shops) => shops,
  areaRankForShop: (shop, orderedShops, maxRank = 5) => {
    const index = orderedShops.findIndex((item) => item.id === shop.id);
    return index >= 0 && index < maxRank ? index + 1 : null;
  }
};
const controls = compileModule("lib/area-shop-list-controls.ts", {
  "@/lib/area-shop-utils": areaShopUtilsStub,
  "@/lib/area-shop-ranking": areaRankingStub
});

const { resolveAreaShopListCardRank, SHOP_LIST_SORT_OPTIONS } = controls;
assert.equal(typeof resolveAreaShopListCardRank, "function", "route rank policy must be a real shared function");
const orderedShops = [{ id: 1 }, { id: 2 }];
assert.equal(
  resolveAreaShopListCardRank(orderedShops[0], orderedShops, { route: "hub", sortId: "recommended", page: 1 }),
  1,
  "hub recommended page one may show an eligible rank"
);
assert.equal(
  resolveAreaShopListCardRank(orderedShops[0], orderedShops, { route: "hub", sortId: "updated", page: 1 }),
  null,
  "non-recommended hub sorts must hide rank"
);
assert.equal(
  resolveAreaShopListCardRank(orderedShops[0], orderedShops, { route: "area", sortId: "recommended", page: 2 }),
  null,
  "regular area pages after page one must hide rank"
);
assert.equal(
  resolveAreaShopListCardRank(orderedShops[0], orderedShops, { route: "shops", sortId: "recommended", page: 1 }),
  null,
  "the general shops route must always hide rank"
);

assert.deepEqual(
  Array.from(SHOP_LIST_SORT_OPTIONS, ({ id }) => id),
  ["recommended", "updated", "price-asc", "late-night", "station"],
  "sort IDs are URL compatibility contracts"
);
assert.equal(
  SHOP_LIST_SORT_OPTIONS.find(({ id }) => id === "station")?.label,
  "駅名・徒歩案内あり"
);

const hubList = routeSources[0][1];
for (const contract of [
  'params.get("filters") ?? params.get("filter")',
  '.get("sort")',
  'url.searchParams.set("filters", activeFilters.join(","))',
  'url.searchParams.set("sort", activeSort)',
  'window.history.replaceState({}, "", next)',
  'window.addEventListener("popstate", syncControlsFromUrl)',
  'setVisibleCount((count) => count + pageSize.loadMore)'
]) {
  assert.ok(hubList.includes(contract), `hub query/filter/load-more contract missing: ${contract}`);
}

const shopsRoute = routeSources[2][1];
assert.match(shopsRoute, /showRank=\{false\}/, "/shops must explicitly disable rank presentation");
assert.match(shopsRoute, /rank=\{null\}/, "/shops must explicitly pass no rank");

const css = read("app/globals.css");
assert.ok(
  !/\b(?:html|body)\b[^{}]*\{[^{}]*overflow-x\s*:\s*hidden/si.test(css),
  "document overflow must not be hidden globally"
);

const packageJson = JSON.parse(read("package.json"));
assert.equal(
  packageJson.scripts["test:area-list-route-contract"],
  "node scripts/check-area-list-route-contract.mjs"
);
assert.ok(packageJson.scripts.test.includes("npm run test:area-list-route-contract"));

console.log("area list route contract checks passed");
