import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

const precision = compileModule("lib/priority-area-precision.ts", {
  "@/lib/area-shop-list-controls": { matchesShopListFilter: () => false },
});
assert.equal(
  typeof precision.selectAreaRelationShops,
  "function",
  "Area listing needs one relation-based membership selector",
);

const target = { id: 7, slug: "nihonbashi", name: "大阪日本橋" };
const areaTerm = (id, slug, name) => ({ id, slug, name, taxonomy: "area" });
const shop = ({ id, primaryArea, terms }) => ({
  id,
  slug: `shop-${id}`,
  title: `店舗${id}`,
  primaryArea,
  terms,
  acf: {},
  ranking: {
    isPr: false,
    promotion: { canReceiveNaturalRankNumber: true },
  },
});
const samePrimary = shop({ id: 1, primaryArea: target, terms: [areaTerm(7, "nihonbashi", "大阪日本橋")] });
const otherPrimary = shop({
  id: 2,
  primaryArea: { id: 4, slug: "umeda", name: "梅田" },
  terms: [areaTerm(7, "nihonbashi", "大阪日本橋"), areaTerm(4, "umeda", "梅田")],
});
const nullPrimary = shop({ id: 3, primaryArea: null, terms: [areaTerm(7, "nihonbashi", "大阪日本橋")] });
const outside = shop({ id: 4, primaryArea: null, terms: [areaTerm(4, "umeda", "梅田")] });
const duplicateSlug = { ...nullPrimary, id: 5, slug: samePrimary.slug };

assert.deepEqual(
  Array.from(precision.selectAreaRelationShops([samePrimary, otherPrimary, nullPrimary, outside], target), ({ id }) => id),
  [1, 2, 3],
  "same, other, and null Primary states must share one Area relation listing",
);
assert.throws(
  () => precision.selectAreaRelationShops([samePrimary, { ...samePrimary }], target),
  /duplicate.*1/iu,
  "duplicate canonical WP IDs must not produce duplicate cards",
);

const ranking = compileModule("lib/area-shop-ranking.ts", {
  "@/lib/shop-ranking": {
    sortShopsForRanking: () => {
      throw new Error("legacy recommendation sorting must not run for formal ranking UI");
    },
  },
});
assert.equal(
  typeof ranking.resolveFormalAreaRankingItems,
  "function",
  "Ranking UI needs a formal-record-only adapter",
);
const formalItems = ranking.resolveFormalAreaRankingItems(
  [samePrimary, otherPrimary, nullPrimary],
  [
    { rank: 3, shopSlug: nullPrimary.slug },
    { rank: 1, shopSlug: samePrimary.slug },
    { shopSlug: otherPrimary.slug },
  ],
);
assert.deepEqual(
  Array.from(formalItems, ({ rank, shop: rankedShop }) => ({ rank, shopId: rankedShop.id })),
  [{ rank: 1, shopId: 1 }, { rank: 3, shopId: 3 }],
  "formal ranks must preserve explicit values and gaps without index fallback",
);
assert.deepEqual(
  Array.from(ranking.resolveFormalAreaRankingItems([samePrimary], [])),
  [],
  "missing formal records must keep the ranking UI empty",
);
assert.deepEqual(
  Array.from(ranking.resolveFormalAreaRankingItems([samePrimary, duplicateSlug], [{ rank: 1, shopSlug: samePrimary.slug }])),
  [],
  "ambiguous Shop slugs must fail closed instead of ranking the wrong canonical entity",
);
assert.deepEqual(
  Array.from(ranking.resolveFormalAreaRankingItems(
    [samePrimary, otherPrimary, nullPrimary],
    [
      { rank: 1, shopSlug: samePrimary.slug },
      { rank: 1, shopSlug: otherPrimary.slug },
      { rank: "2", shopSlug: nullPrimary.slug },
    ],
  )),
  [],
  "duplicate ranks and string-coerced ranks must fail closed instead of depending on record order",
);
assert.deepEqual(
  Array.from(ranking.resolveFormalAreaRankingItems(
    [samePrimary],
    [
      { rank: 1, shopSlug: samePrimary.slug },
      { rank: 2, shopSlug: samePrimary.slug },
    ],
  )),
  [],
  "duplicate formal Shop records must fail closed instead of choosing one by array order",
);

const template = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(template.includes("selectAreaRelationShops"), "Priority Area template must use relation membership");
for (const forbiddenIntegration of [
  "SecondaryShopLinks",
  "precisionGroups.exact",
  "precisionGroups.related",
  "precisionGroups.unclassified",
  "data-area-precision-secondary",
]) {
  assert.equal(template.includes(forbiddenIntegration), false, `public Area template must remove ${forbiddenIntegration}`);
}

const areaHubConfig = compileModule("lib/area-hub-config.ts");
const prioritySlugs = ["sakai", "shinosaka", "nihonbashi", "sakaisujihonmachi", "umeda"];
const publicAreaSources = [
  template,
  ...prioritySlugs.map((slug) => JSON.stringify(areaHubConfig.getHubTemplateConfig(slug)?.seo ?? {})),
].join("\n");
for (const forbiddenCopy of [
  "主な掲載エリア",
  "主エリア",
  "主店舗",
  "関連掲載",
  "関連店舗",
  "確認中の店舗",
]) {
  assert.equal(publicAreaSources.includes(forbiddenCopy), false, `public Area copy must remove ${forbiddenCopy}`);
}

const rankingCards = read("components/area/hub/RankingHeroCards.tsx");
assert.equal(/\.map\(\(shop,\s*index\)/u.test(rankingCards), false, "ranking cards must not derive rank from array index");
assert.equal(rankingCards.includes("index + 1"), false, "ranking cards must not synthesize rank values");
assert.ok(rankingCards.includes("item.rank"), "ranking cards must render the explicit formal rank");

const areaContent = read("components/area/area-hub-content.tsx");
assert.ok(areaContent.includes("resolveFormalAreaRankingItems"), "ranking section must use the formal-only adapter");
assert.ok(areaContent.includes("item.rank <= 5"), "top-five UI must preserve explicit rank gaps instead of slicing arbitrary records");
assert.ok(areaContent.includes("showCompareLink ?"), "ranking CTA must not create a dangling compare-tabs fragment");
assert.equal(areaContent.includes("if (precisionMode) return null"), false, "Priority Areas must be able to render future formal records");
assert.equal(areaContent.includes("orderShopsForAreaRanking(rankingShops"), false, "ranking section must not fall back to legacy recommendation sorting");

const route = read("app/area/[slug]/page.tsx");
assert.ok(route.includes("shouldLoadLegacyAreaRanking(area)"), "legacy ranking source must remain disconnected from Priority Areas");

console.log("Area list UX revision contract: PASS");
