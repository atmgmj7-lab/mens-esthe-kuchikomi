import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function compileModule(path, requireMap = {}) {
  assert.ok(existsSync(join(root, path)), `${path} must exist`);
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: path,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `${path} must transpile`);

  const loaded = { exports: {} };
  const localRequire = (id) => {
    if (Object.hasOwn(requireMap, id)) return requireMap[id];
    throw new Error(`Unexpected require from ${path}: ${id}`);
  };
  vm.runInNewContext(
    compiled.outputText,
    { module: loaded, exports: loaded.exports, require: localRequire },
    { filename: `${path}.cjs` },
  );
  return loaded.exports;
}

function runtimeFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) return runtimeFiles(child);
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx|mjs)$/u.test(entry.name)) return [];
    return [child];
  });
}

const areaUtils = {
  isBeginnerFriendlyShop: (shop) => Boolean(shop.acf?.shop_features?.includes("初心者向け")),
  isStationNearShop: (shop) => Boolean(shop.acf?.shop_station && shop.acf?.shop_walk_minutes),
};
const precision = compileModule("lib/priority-area-precision.ts", {
  "@/lib/area-shop-utils": areaUtils,
});
const areaRanking = compileModule("lib/area-shop-ranking.ts", {
  "@/lib/shop-ranking": { sortShopsForRanking: (shops) => shops },
});
assert.deepEqual(
  JSON.parse(JSON.stringify(areaRanking.normalizeAreaShopRankingEntries([
    { shopSlug: "first", rank: 1 },
    { shopSlug: "third", rank: 3 },
  ]))),
  [{ shopSlug: "first", rank: 1 }, { shopSlug: "third", rank: 3 }],
  "formal ranking normalization must preserve explicit gaps",
);
const realAreaUtils = compileModule("lib/area-shop-utils.ts", {
  "@/lib/area-hub-config": {
    fillHubPageToken: (value) => value,
    getHubTemplateConfig: () => null,
  },
  "@/lib/wp/client": { safeText: (value, fallback = "") => typeof value === "string" ? value : fallback },
  "@/lib/price-normalization": {
    formatPriceForDisplay: () => "",
    normalizePrice: () => ({ status: "unknown" }),
    PRIMARY_PRICE_FIELD_KEYS: [],
    resolveShopPrimaryPrice: () => ({ status: "unknown" }),
  },
  "@/lib/content-provenance": { normalizeContentItems: () => [] },
  "@/lib/review-rating": {
    resolveShopReviewSummary: () => ({ reviewCount: 0, aggregate: null }),
    shouldDisplayAggregateRating: () => false,
  },
  "@/lib/shop-fact-normalization": {
    normalizeShopDisplayText: (value) => typeof value === "string" ? value.trim() : "",
    normalizeShopFactText: (value) => typeof value === "string" ? value.trim() : "",
  },
  "@/lib/shop-ranking": {
    sortShopsForRanking: (shops) => shops,
    selectRankingTopShops: (shops) => shops,
  },
});
const stationFixture = (acf) => ({ acf, terms: [], primaryArea: null });
assert.equal(
  realAreaUtils.isStationNearShop(stationFixture({ shop_access: "日本橋駅 徒歩1分" })),
  false,
  "generic shop_access alone must never become formal station data",
);
assert.equal(
  realAreaUtils.isStationNearShop(stationFixture({ shop_station: "日本橋駅" })),
  false,
  "a dedicated station without walk information is insufficient",
);
assert.equal(
  realAreaUtils.isStationNearShop(stationFixture({ shop_station: "日本橋駅", shop_walk_minutes: 3 })),
  true,
  "dedicated station and walk information enable station data",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(areaRanking.normalizeAreaShopRankingEntries([
    { shopSlug: "missing-rank" },
  ]))),
  [],
  "missing or invalid formal ranks must not be inferred from array order",
);

const priorityAreas = [
  { id: 17, slug: "sakai", name: "堺東", expected: 6 },
  { id: 13, slug: "shinosaka", name: "新大阪", expected: 3 },
  { id: 7, slug: "nihonbashi", name: "大阪日本橋", expected: 12 },
  { id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", expected: 18 },
  { id: 4, slug: "umeda", name: "梅田", expected: 5 },
];

for (const area of priorityAreas) {
  assert.equal(precision.isPriorityAreaPrecisionTarget(area), true, `${area.slug} must enable precision mode by ID`);
}
for (const area of [
  { id: 999, slug: "sakai", name: "堺東" },
  { id: 1, slug: "nanba", name: "難波" },
  { id: 999, slug: "umeda", name: "梅田" },
]) {
  assert.equal(
    precision.isPriorityAreaPrecisionTarget(area),
    false,
    `non-canonical ID ${area.id} must not enable precision mode from name or slug`,
  );
}

const target = priorityAreas[2];
const term = (id, slug, name) => ({ id, slug, name, parent: id === 2 ? 0 : 2, count: 1, taxonomy: "area" });
const shop = ({ id, title, primaryArea, terms, acf = {}, slug = `shop-${id}` }) => ({
  id,
  slug,
  title,
  primaryArea,
  terms,
  acf,
});
const exact = shop({ id: 1, title: "完全一致", primaryArea: target, terms: [term(7, "nihonbashi", "日本橋")] });
const related = shop({
  id: 2,
  title: "関連店舗",
  primaryArea: priorityAreas[4],
  terms: [term(7, "nihonbashi", "日本橋"), term(4, "umeda", "梅田")],
});
const unclassified = shop({
  id: 3,
  title: "大阪日本橋",
  primaryArea: null,
  terms: [term(7, "nihonbashi", "大阪日本橋")],
  acf: { shop_address: "大阪日本橋駅 徒歩1分" },
  slug: "nihonbashi",
});
const groups = precision.classifyPriorityAreaShops([exact, related, unclassified], target);
assert.deepEqual(Array.from(groups.exact, ({ id }) => id), [1], "explicit matching Primary ID alone creates EXACT");
assert.deepEqual(Array.from(groups.related, ({ id }) => id), [2], "different explicit Primary with legacy relation creates RELATED");
assert.deepEqual(Array.from(groups.unclassified, ({ id }) => id), [3], "null Primary with legacy relation creates UNCLASSIFIED");
assert.equal(groups.exact.includes(unclassified), false, "name, slug, address, and relation order must not infer EXACT");

assert.throws(
  () => precision.classifyPriorityAreaShops([exact, { ...exact }], target),
  /duplicate.*1/iu,
  "duplicate canonical WP IDs must be rejected",
);
const sameNameGroups = precision.classifyPriorityAreaShops([
  shop({ id: 10, title: "同名店舗", primaryArea: target, terms: [term(7, "nihonbashi", "日本橋")] }),
  shop({ id: 11, title: "同名店舗", primaryArea: target, terms: [term(7, "nihonbashi", "日本橋")] }),
], target);
assert.deepEqual(Array.from(sameNameGroups.exact, ({ id }) => id), [10, 11], "same names with distinct WP IDs must remain distinct");

const preview = JSON.parse(read("../docs/data-clean/priority5/primary-area-backfill-preview-2026-08-16.json"));
assert.equal(preview.records.length, 44, "the accepted preview fixture must retain 44 records");
const fixtureShops = preview.records.map((record) => shop({
  id: record.wpShopId,
  slug: record.shopSlug,
  title: record.shopName,
  primaryArea: {
    id: record.targetPrimaryArea.termId,
    slug: record.targetPrimaryArea.slug,
    name: record.targetPrimaryArea.label,
  },
  terms: record.currentAreaRelations.map((area) => term(area.termId, area.slug, area.label)),
}));
for (const area of priorityAreas) {
  const fixtureGroups = precision.classifyPriorityAreaShops(fixtureShops, area);
  assert.equal(fixtureGroups.exact.length, area.expected, `${area.slug} fixture EXACT count`);
}

const noCapabilities = precision.resolvePriorityAreaCapabilities([
  shop({
    id: 20,
    title: "汎用アクセスのみ",
    primaryArea: target,
    terms: [term(7, "nihonbashi", "日本橋")],
    acf: { shop_access: "日本橋駅 徒歩1分" },
  }),
], target);
assert.deepEqual(
  JSON.parse(JSON.stringify(noCapabilities)),
  { beginner: false, station: false },
  "generic access copy must not enable beginner/station UI",
);
const capabilities = precision.resolvePriorityAreaCapabilities([
  shop({
    id: 21,
    title: "正式情報あり",
    primaryArea: target,
    terms: [term(7, "nihonbashi", "日本橋")],
    acf: { shop_features: ["初心者向け"], shop_station: "日本橋駅", shop_walk_minutes: 3 },
  }),
], target);
assert.deepEqual(
  JSON.parse(JSON.stringify(capabilities)),
  { beginner: true, station: true },
  "validated data must enable the matching UI only",
);

const ranked = precision.resolveStrictAreaRanking(
  [exact, related, unclassified],
  [{ shopSlug: exact.slug, rank: 1 }, { shopSlug: unclassified.slug, rank: 3 }],
);
assert.deepEqual(Array.from(ranked, ({ shop: rankedShop, rank }) => [rankedShop.id, rank]), [[1, 1], [3, 3]], "formal ranks keep explicit gaps");
assert.deepEqual(Array.from(precision.resolveStrictAreaRanking([exact], [])), [], "missing formal records must not create ranking");
assert.equal(ranked.some(({ rank }) => rank === 2), false, "formal ranking gaps must never be renumbered");

const runtimeSourceFiles = ["app", "components", "lib"].flatMap(runtimeFiles);
for (const file of runtimeSourceFiles) {
  const source = read(file);
  assert.equal(
    /primary-area-backfill-preview|docs\/data-clean\/priority5/iu.test(source),
    false,
    `production runtime must not import preview fixture: ${relative(root, join(root, file))}`,
  );
}

const template = read("components/area/AreaHubPageTemplate.tsx");
for (const contract of [
  "isPriorityAreaPrecisionTarget",
  "classifyPriorityAreaShops",
  "precisionGroups.exact",
  "precisionGroups.related",
  "precisionGroups.unclassified",
  "precisionMode",
]) {
  assert.ok(template.includes(contract), `Area Hub integration is missing ${contract}`);
}
const content = read("components/area/area-hub-content.tsx");
assert.ok(content.includes("resolveStrictAreaRanking"), "priority ranking must use formal records only");
assert.ok(content.includes("capabilities.beginner"), "beginner tab must share validated availability");
assert.ok(content.includes("capabilities.station"), "station tab must share validated availability");
assert.ok(template.includes('rankingShops={mainShops}'), "strict ranking must receive EXACT shops only in precision mode");
const rankingSource = read("lib/area-shop-ranking.ts");
assert.ok(!rankingSource.includes(".map((entry, index) => ({ ...entry, rank: index + 1 }))"), "formal ranks must not be renumbered");

const routeSource = read("app/area/[slug]/page.tsx");
assert.equal((routeSource.match(/generateMetadata/gu) ?? []).length, 1, "area metadata contract remains singular");
assert.ok(routeSource.includes("canonicalOverride: canonicalUrl(requestPath)"), "existing canonical behavior remains connected");
const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.scripts["test:priority-area-precision"], "node scripts/check-priority-area-precision-contract.mjs");
assert.ok(packageJson.scripts.test.includes("npm run test:priority-area-precision"));

console.log("priority area precision contract checks passed");
