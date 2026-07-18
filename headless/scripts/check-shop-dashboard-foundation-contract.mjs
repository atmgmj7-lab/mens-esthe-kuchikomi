import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const projectRoot = join(root, "..");
const read = (file) => readFileSync(join(root, file), "utf8");

function loadTypeScript(file, overrides = {}) {
  const source = read(file);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  const require = (id) => {
    if (id === "node:crypto") return { createHash };
    if (id === "server-only") return {};
    if (Object.hasOwn(overrides, id)) return overrides[id];
    throw new Error(`Unexpected require from ${file}: ${id}`);
  };
  vm.runInNewContext(
    compiled,
    { module, exports: module.exports, require, URL, Date, console },
    { filename: file }
  );
  return module.exports;
}

for (const file of [
  "lib/shop-information-coverage.ts",
  "lib/shop-detail-modules.ts",
  "components/shop-detail/ShopInformationCoverage.tsx",
  "components/shop-detail/ShopRankingSnapshot.tsx",
  "components/shop-detail/ShopDetailModuleList.tsx"
]) {
  assert.ok(existsSync(join(root, file)), `${file} must exist`);
}
assert.ok(existsSync(join(projectRoot, "shop-public-meta.php")), "shop-public-meta.php must exist");

const typesSource = read("lib/wp/types.ts");
for (const token of [
  "ShopFactProvenance",
  '"price" | "hours" | "access" | "booking" | "official" | "image"',
  '"official-site" | "shop-provided" | "admin-verified"',
  '"reviewed" | "pending" | "rejected"',
  "ShopAreaRankingSnapshot"
]) {
  assert.ok(typesSource.includes(token), `WordPress types must include ${token}`);
}

const phpSource = readFileSync(join(projectRoot, "shop-public-meta.php"), "utf8");
for (const token of [
  "shop_fact_provenance",
  "shop_area_ranking_snapshot",
  "manage_shop_public_meta",
  "edit_post",
  "register_post_meta",
  "rest_prepare_shop"
]) {
  assert.ok(phpSource.includes(token), `WordPress meta contract must include ${token}`);
}
assert.equal(
  /publishedValueHash[^\n]+(?:hash|sha256|wp_hash)/i.test(phpSource),
  false,
  "WordPress must sanitize a supplied hash, not derive provenance from current values"
);

const coverageModule = loadTypeScript("lib/shop-information-coverage.ts");
const {
  buildShopInformationCoverage,
  canonicalizeShopFactValue,
  hashShopFactValue,
  normalizeShopRankingSnapshot
} = coverageModule;
for (const [name, value] of Object.entries({
  buildShopInformationCoverage,
  canonicalizeShopFactValue,
  hashShopFactValue,
  normalizeShopRankingSnapshot
})) {
  assert.equal(typeof value, "function", `${name} must be exported`);
}

const model = {
  areaName: "堺筋本町",
  catchText: "店舗紹介",
  introductionText: "確認できる公開情報を掲載しています。",
  recommendText: "",
  summaryText: "",
  featureNames: ["個室"],
  prices: [
    { key: "price_120", label: "120分", price: { status: "confirmed", amount: 22000 } },
    { key: "price_90", label: "90分", price: { status: "confirmed", amount: 16000 } }
  ],
  infoRows: [
    { key: "station", label: "駅・アクセス案内", value: " 堺筋本町駅   3番出口\r\n 徒歩5分 " },
    { key: "address", label: "住所", value: "大阪府大阪市中央区久太郎町1丁目6-1" },
    { key: "hours", label: "営業時間", value: "10:00〜翌5:00" }
  ],
  actions: [
    { kind: "official", label: "公式", href: "https://example.test", external: true },
    { kind: "tel", label: "電話", href: "tel:08000000000", external: false }
  ],
  images: [
    { url: "https://example.test/one.jpg", alt: "one", isFallback: false },
    { url: "/images/eskomi-shop-fallback.svg", alt: "fallback", isFallback: true },
    { url: "https://example.test/two.jpg", alt: "two", isFallback: false }
  ]
};

assert.equal(
  canonicalizeShopFactValue("price", model),
  '[{"durationMinutes":90,"priceYen":16000},{"durationMinutes":120,"priceYen":22000}]'
);
assert.equal(
  canonicalizeShopFactValue("access", model),
  '["堺筋本町駅 3番出口\\n徒歩5分","大阪府大阪市中央区久太郎町1丁目6-1"]'
);
assert.equal(
  hashShopFactValue("price", model),
  hashShopFactValue("price", structuredClone(model)),
  "equivalent values must always produce the same hash"
);

const reviewedAt = "2026-07-18";
const priceProvenance = {
  field: "price",
  sourceUrl: "https://example.test/system/",
  sourceType: "official-site",
  observedAt: "2026-07-15",
  reviewedAt,
  reviewStatus: "reviewed",
  publishedValueHash: hashShopFactValue("price", model)
};
const coverage = buildShopInformationCoverage(model, [priceProvenance]);
assert.equal(coverage?.verifiedCount, 1);
assert.equal(coverage?.totalCount, 6);
assert.equal(coverage?.latestReviewedAt, reviewedAt);
assert.deepEqual(
  Array.from(coverage?.items ?? [], ({ key, verified }) => ({ key, verified })),
  [
    { key: "price", verified: true },
    { key: "hours", verified: false },
    { key: "access", verified: false },
    { key: "booking", verified: false },
    { key: "official", verified: false },
    { key: "image", verified: false }
  ]
);

const changedPrice = {
  ...model,
  prices: [{ key: "price_90", label: "90分", price: { status: "confirmed", amount: 17000 } }]
};
assert.equal(buildShopInformationCoverage(changedPrice, [priceProvenance])?.verifiedCount, 0);
assert.equal(buildShopInformationCoverage(model, null), null, "missing provenance must hide coverage");

const bookingHash = hashShopFactValue("booking", model);
const bookingChanged = {
  ...model,
  actions: [
    ...model.actions,
    { kind: "line", label: "LINE", href: "https://line.me/R/ti/p/example", external: true }
  ]
};
assert.notEqual(hashShopFactValue("booking", bookingChanged), bookingHash);
const imageChanged = { ...model, images: [...model.images].reverse() };
assert.notEqual(hashShopFactValue("image", imageChanged), hashShopFactValue("image", model));

const ranking = {
  areaSlug: "sakaisujihonmachi",
  rank: 3,
  totalEligibleShops: 42,
  basis: "確認済みのエリア内ランキング",
  observedAt: "2026-07-18",
  isPr: false
};
assert.deepEqual(
  JSON.parse(JSON.stringify(normalizeShopRankingSnapshot([ranking]))),
  ranking,
  "a complete explicit ranking snapshot must be displayable"
);
for (const key of Object.keys(ranking)) {
  const invalid = { ...ranking };
  delete invalid[key];
  assert.equal(normalizeShopRankingSnapshot([invalid]), null, `${key} is required for ranking display`);
}

const moduleExports = loadTypeScript("lib/shop-detail-modules.ts");
const { SHOP_DETAIL_MODULES, getVisibleShopDetailModules, buildShopSectionLinks } = moduleExports;
assert.ok(Array.isArray(SHOP_DETAIL_MODULES));
assert.deepEqual(
  Array.from(SHOP_DETAIL_MODULES, ({ id }) => String(id)),
  ["reviews", "shop-information", "prices", "features", "map-access", "basic-information", "nearby"]
);
assert.ok(SHOP_DETAIL_MODULES.some((item) => item.layer === "primary"));
assert.ok(SHOP_DETAIL_MODULES.some((item) => item.layer === "secondary"));

const emptyContext = {
  model: {
    ...model,
    prices: [],
    infoRows: [],
    catchText: "",
    introductionText: "",
    recommendText: "",
    summaryText: "",
    featureNames: []
  },
  review: {},
  coverage: null,
  ranking: null,
  hasNearby: false
};
const emptyModules = getVisibleShopDetailModules(emptyContext);
assert.deepEqual(Array.from(emptyModules, ({ id }) => id), ["reviews"]);
assert.equal(
  emptyModules.some(({ id }) => id === "shop-information"),
  false,
  "missing provenance and shop information must not create an empty information module"
);

const fullModules = getVisibleShopDetailModules({
  ...emptyContext,
  model,
  coverage,
  ranking: normalizeShopRankingSnapshot([ranking]),
  hasNearby: true
});
const links = buildShopSectionLinks(fullModules);
assert.ok(links.every((link) => link.layer === "primary" || link.layer === "secondary"));
assert.equal(new Set(links.map(({ id }) => id)).size, links.length);

const navSource = read("components/shop-detail/ShopSectionNav.tsx");
assert.ok(navSource.includes('link.layer === "primary"'), "navigation must render the primary layer");
assert.ok(navSource.includes('link.layer === "secondary"'), "navigation must render the secondary layer");
assert.equal(navSource.includes('role="tab"'), false, "same-page links must remain anchors");

const sectionsSource = read("components/shop-detail/ShopDetailSections.tsx");
assert.ok(sectionsSource.includes("ShopDetailModuleList"), "ShopDetailSections must delegate to the module list");
for (const staleCondition of ["model.prices.length > 0", "model.infoRows.length > 0", "model.featureNames.length > 0"]) {
  assert.equal(sectionsSource.includes(staleCondition), false, `wrapper must not duplicate ${staleCondition}`);
}

const detailSource = read("components/ShopDetail.tsx");
assert.ok(detailSource.includes("getVisibleShopDetailModules"));
assert.ok(detailSource.includes("buildShopInformationCoverage"));
assert.ok(detailSource.includes("normalizeShopRankingSnapshot"));

const cssSource = read("components/shop-detail/ShopDetail.module.css");
assert.match(cssSource, /\.shell\s*\{[^}]*max-width:\s*1200px/s);
assert.match(cssSource, /@media \(max-width:\s*1024px\)[\s\S]*\.detailGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);

console.log("shop dashboard foundation contract checks passed");
