import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const fixture = JSON.parse(read("scripts/fixtures/area-template-v2-foundation-contract.json"));

function compileModule(file, requireMap = {}) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `${file} must transpile`);

  const loaded = { exports: {} };
  const localRequire = (id) => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return jsxRuntime;
    if (Object.hasOwn(requireMap, id)) return requireMap[id];
    throw new Error(`Unexpected require from ${file}: ${id}`);
  };
  vm.runInNewContext(
    compiled.outputText,
    { module: loaded, exports: loaded.exports, require: localRequire },
    { filename: `${file}.cjs` },
  );
  return loaded.exports;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function marker(name, tag = "section") {
  return function ContractMarker({ children }) {
    return React.createElement(tag, { "data-contract": name }, children);
  };
}

function assertInOrder(html, labels) {
  let previous = -1;
  for (const [label, token] of labels) {
    const current = html.indexOf(token);
    assert.ok(current >= 0, `${label} must render`);
    assert.ok(current > previous, `${label} must follow the preceding contract section`);
    previous = current;
  }
}

function jsonLdOfType(html, type) {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/gu)) {
    const value = JSON.parse(match[1]);
    if (value["@type"] === type) return value;
  }
  return null;
}

function routeAstEvidence(file) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const evidence = { callsSharedRenderer: false, staticAreaRoutes: [], aliases: {} };
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "renderAreaHubRouteContent") {
      evidence.callsSharedRenderer = true;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "STATIC_AREA_ROUTES") {
      const values = node.initializer?.arguments?.[0]?.elements ?? [];
      evidence.staticAreaRoutes = values.filter(ts.isStringLiteral).map((entry) => entry.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "AREA_SLUG_ALIASES") {
      for (const property of node.initializer?.properties ?? []) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) continue;
        const key = ts.isStringLiteral(property.name) ? property.name.text : property.name.text;
        evidence.aliases[key] = property.initializer.text;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return evidence;
}

const hubConfig = compileModule("lib/area-hub-config.ts");
const editorialData = compileModule("lib/area-depth-editorial.ts");
const editorialComponents = compileModule("components/area/AreaEditorialDepth.tsx", {
  "./AreaEditorialDepth.module.css": new Proxy({}, { get: (_, key) => String(key) }),
});
const seo = compileModule("lib/seo.ts", {
  "@/lib/price-normalization": {
    formatPriceForDisplay: () => "",
    resolveShopPrimaryPrice: () => ({ status: "unknown" }),
    shouldOutputPriceSchema: () => false,
  },
  "@/lib/shop-fact-normalization": { normalizeShopAddress: () => null },
  "@/lib/wp/client": {
    stripHtml: (value) => typeof value === "string" ? value.replace(/<[^>]*>/gu, "").trim() : "",
  },
});
const precision = compileModule("lib/priority-area-precision.ts", {
  "@/lib/area-shop-list-controls": { matchesShopListFilter: () => false },
});

// A/F: the five canonical areas remain on the shared hub contract. Static routes are
// excluded from dynamic generation and explicitly bridge into the shared renderer.
for (const areaFixture of fixture.areas) {
  assert.equal(hubConfig.isHubTemplateArea(areaFixture.slug), true, `${areaFixture.slug} uses the hub template`);
  assert.equal(
    precision.isPriorityAreaPrecisionTarget({ id: areaFixture.termId }),
    true,
    `${areaFixture.slug} precision is bound to its canonical term ID`,
  );
  assert.equal(
    precision.isPriorityAreaPrecisionTarget({ id: areaFixture.termId + 10_000 }),
    false,
    `${areaFixture.slug} precision must not be inferred from its slug`,
  );

  const config = hubConfig.getHubTemplateConfig(areaFixture.slug);
  assert.ok(config, `${areaFixture.slug} config exists`);
  assert.equal(config.seo.hubTitle, areaFixture.title, `${areaFixture.slug} title contract`);
  assert.equal(config.seo.hubDescription, areaFixture.description, `${areaFixture.slug} description contract`);
  assert.equal(config.seo.shopListH2, areaFixture.shopListH2, `${areaFixture.slug} list heading contract`);

  const countForEditorial = areaFixture.publicShopCount ?? 1;
  assert.equal(
    Boolean(editorialData.resolveAreaDepthEditorial(areaFixture.slug, countForEditorial)),
    areaFixture.editorial,
    `${areaFixture.slug} editorial availability contract`,
  );
  if (areaFixture.editorial) {
    assert.equal(
      editorialData.resolveAreaDepthEditorial(areaFixture.slug, countForEditorial - 1),
      null,
      `${areaFixture.slug} count drift fails closed`,
    );
  }
}

const dynamicRouteEvidence = routeAstEvidence("app/area/[slug]/page.tsx");
assert.equal(dynamicRouteEvidence.callsSharedRenderer, true, "dynamic priority routes call the shared renderer");
assert.deepEqual(dynamicRouteEvidence.staticAreaRoutes.sort(), ["sakai", "shinosaka"]);
for (const alias of fixture.aliases) {
  assert.equal(dynamicRouteEvidence.aliases[alias.from], alias.to, `${alias.from} alias remains stable`);
}

const sharedRouteModule = compileModule("components/area/AreaHubRouteContent.tsx", {
  "@/components/area/AreaHubPageTemplate": {
    AreaHubPageTemplate: ({ area, allShops, legacyPage }) => React.createElement(
      "div",
      { "data-contract": "shared-template", "data-slug": area.slug, "data-page": legacyPage },
      String(allShops.length),
    ),
  },
  "@/lib/area-shop-utils": {
    resolveAreaHubContext: () => ({}),
    resolveAreaHubPageDescription: () => "description",
    resolveAreaHubPageTitle: () => "title",
  },
  "@/lib/area-shop-ranking": { resolveAreaRankingEntries: () => [] },
  "@/lib/priority-area-hub": { loadPriorityAreaApprovedReviews: async () => null },
  "@/lib/priority-area-precision": { shouldLoadLegacyAreaRanking: () => false },
  "@/lib/wp/areas": {
    getAreaBySlug: async () => null,
    getAreaRankingShops: async () => [{ id: 1 }],
    getChildAreas: async () => [],
    getParentArea: async () => null,
    getSiblingAreas: async () => [],
  },
  "@/lib/wp/area-shop-rankings": { getAreaShopRankings: async () => ({}) },
  "@/lib/wp/home-featured-areas": { getHomeFeaturedAreas: async () => [] },
  "@/lib/wp/build-resilience": { withWpBuildFallback: async (_label, run) => run() },
  "@/lib/seo": seo,
});

const staticRouteModule = compileModule("components/area/AreaDepthStaticRoute.tsx", {
  "next/navigation": { notFound: () => { throw new Error("unexpected notFound"); } },
  "@/components/area/AreaHubRouteContent": sharedRouteModule,
  "@/lib/wp/areas": { getAreaBySlug: async (slug) => ({ id: slug === "shinosaka" ? 13 : 17, slug }) },
  "@/lib/wp/build-resilience": { withWpBuildFallback: async (_label, run) => run() },
});

for (const areaFixture of fixture.areas.filter(({ routeKind }) => routeKind === "dedicated-static")) {
  const pageModule = compileModule(areaFixture.routeFile, {
    "@/components/area/AreaDepthStaticRoute": staticRouteModule,
    "@/components/area/AreaHubRouteContent": {
      generateAreaHubRouteMetadata: async (slug, page) => ({ slug, page }),
    },
  });
  const firstHop = pageModule.default();
  assert.equal(firstHop.props.slug, areaFixture.slug, `${areaFixture.slug} dedicated route keeps its slug`);
  const sharedResult = await staticRouteModule.AreaDepthStaticRoute({ slug: areaFixture.slug });
  const sharedHtml = renderToStaticMarkup(sharedResult);
  assert.match(sharedHtml, /data-contract="shared-template"/u, `${areaFixture.slug} reaches AreaHubPageTemplate`);
  assert.match(sharedHtml, /data-page="1"/u, `${areaFixture.slug} dedicated route remains page one`);

  const pageTwoMetadata = await pageModule.generateMetadata({ searchParams: Promise.resolve({ page: "2" }) });
  assert.deepEqual(clone(pageTwoMetadata), { slug: areaFixture.slug, page: 2 });
}

// B/C/D/E: render the actual page template and disclosure against bounded shop fixtures.
// Unrelated child modules are semantic markers so this test locks their relative positions
// without duplicating their own focused behavior tests.
const AreaHubSectionShell = ({ id, children }) => React.createElement("section", { id, "data-contract": id }, children);
const AreaHubSectionHeader = ({ ja }) => React.createElement("h2", null, ja);
const AreaShopList = ({ shops }) => React.createElement(
  "div",
  { "data-contract": "filter" },
  shops.map((shop) => React.createElement("a", { href: `/shops/${shop.slug}/`, key: shop.id }, shop.title)),
);
const areaContent = {
  AreaHubCompareTabsSections: marker("comparison"),
  AreaHubLocalGuideSection: marker("local-guide"),
  AreaHubPriceAndGuideSections: marker("following-content"),
  AreaHubRankingTop: marker("ranking-top"),
  AreaFaqSection: marker("faq"),
  buildFaqItems: (context, options) => [
    ...(context.faqItems ?? [{ question: "選び方は？", answer: "公開情報を確認します。" }]),
    ...(options.additionalItems ?? []),
  ],
};
const areaUtils = {
  aggregateReviewCountLabel: () => "0件",
  resolveAreaHubContext: (area, parentArea) => {
    const config = hubConfig.getHubTemplateConfig(area.slug).seo;
    return {
      ...config,
      slug: area.slug,
      name: area.name,
      parentSlug: parentArea?.slug ?? "osaka",
      parentName: parentArea?.name ?? "大阪",
    };
  },
  resolveLastUpdatedLabel: () => null,
};
const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const templateModule = compileModule("components/area/AreaHubPageTemplate.tsx", {
  "@/components/area/hub/AreaPromotionSection": { AreaPromotionSection: marker("promotion") },
  "next/link": Link,
  "@/components/area/AreaLatestReviews": { AreaLatestReviews: marker("latest-reviews") },
  "@/components/area/hub/AreaHubSectionHeader": { AreaHubSectionHeader },
  "@/components/area/hub/AreaHubSectionShell": { AreaHubSectionShell },
  "@/components/area/area-hub-content": areaContent,
  "@/components/area/hub/AreaHubRelatedAreas": { AreaHubRelatedAreas: marker("related-links") },
  "@/components/area/hub/AreaHubPriorityLinks": { AreaHubPriorityLinks: marker("priority-links") },
  "@/components/area/hub/AreaHubDecisionGuide": { AreaHubDecisionGuide: marker("decision-guide") },
  "@/components/area/hub/AreaShopList": { AreaShopList },
  "@/components/area/AreaEditorialDepth": editorialComponents,
  "@/lib/area-shop-utils": areaUtils,
  "@/lib/area-shop-ranking": {},
  "@/lib/priority-area-precision": precision,
  "@/lib/design-constants": { resolveAreaFeatureVisual: () => ({ image: null, imageAlt: "地域" }) },
  "@/lib/seo": seo,
  "@/lib/area-depth-editorial": editorialData,
});

function makeShop(areaFixture, index) {
  return {
    id: areaFixture.termId * 10_000 + index,
    slug: `${areaFixture.slug}-fixture-shop-${index}`,
    title: `${areaFixture.slug} fixture shop ${index}`,
    terms: [{ id: areaFixture.termId, slug: areaFixture.slug, name: areaFixture.slug, taxonomy: "area" }],
    primaryArea: { id: areaFixture.termId, slug: areaFixture.slug, name: areaFixture.slug },
    ranking: { isPr: index === 1 },
    acf: {},
  };
}

for (const areaFixture of fixture.areas.filter(({ editorial }) => editorial)) {
  const shops = Array.from({ length: areaFixture.publicShopCount }, (_, index) => makeShop(areaFixture, index + 1));
  const area = {
    id: areaFixture.termId,
    slug: areaFixture.slug,
    name: areaFixture.slug,
    count: areaFixture.publicShopCount,
    acf: {},
  };
  const html = renderToStaticMarkup(React.createElement(templateModule.AreaHubPageTemplate, {
    area,
    allShops: shops,
    parentArea: { id: 2, slug: "osaka", name: "大阪", acf: {} },
  }));

  assert.equal((html.match(/data-area-supporting-disclosure="true"/gu) ?? []).length, 1);
  assert.equal((html.match(/data-area-supporting-content="true"/gu) ?? []).length, 1);
  assert.equal((html.match(/data-area-depth="coverage"/gu) ?? []).length, 1);
  assert.equal((html.match(/data-area-depth="portal-therapist"/gu) ?? []).length, 1);
  const details = html.match(/<details[^>]*data-area-supporting-disclosure="true"[^>]*>([^]*?)<\/details>/u);
  assert.ok(details, `${areaFixture.slug} supporting details renders in SSR HTML`);
  assert.doesNotMatch(details[0].slice(0, details[0].indexOf(">")), /\sopen(?:=|\s|>)/u, "details starts closed");
  assert.match(details[1], /<summary/u, "native summary is present");
  assert.match(details[1], /data-area-depth="coverage"/u, "coverage remains inside details");
  assert.match(details[1], /data-area-depth="portal-therapist"/u, "cross-source content remains inside details");
  const outsideDetails = html.replace(details[0], "");
  assert.doesNotMatch(outsideDetails, /data-area-depth="(?:coverage|portal-therapist)"/u, "supporting content is not duplicated outside details");

  assertInOrder(html, [
    ["H1", `<h1 id="area-final-title" class="area-hub-hero__title">${areaFixture.h1}</h1>`],
    ["compact supporting information", "data-area-supporting-disclosure=\"true\""],
    ["shop list", "data-contract=\"shop-list\""],
    ["filter", "data-contract=\"filter\""],
    ["comparison", "data-contract=\"comparison\""],
    ["following content", "data-contract=\"following-content\""],
    ["FAQ", "data-contract=\"faq\""],
    ["related navigation", "data-contract=\"priority-links\""],
  ]);

  const itemList = jsonLdOfType(html, "ItemList");
  assert.ok(itemList, `${areaFixture.slug} ItemList renders`);
  const nonPrShops = shops.filter((shop) => !shop.ranking.isPr);
  assert.equal(itemList.numberOfItems, nonPrShops.length, "ItemList excludes the PR fixture");
  assert.deepEqual(
    clone(itemList.itemListElement.map(({ position, url, name }) => ({ position, url, name }))),
    nonPrShops.map((shop, index) => ({
      position: index + 1,
      url: `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/`,
      name: shop.title,
    })),
    "published non-PR fixture IDs map one-to-one to ItemList entries",
  );
  for (const shop of shops) {
    assert.match(html, new RegExp(`href="/shops/${shop.slug}/"`), `${shop.slug} keeps its shop link`);
  }

  const breadcrumbs = jsonLdOfType(html, "BreadcrumbList");
  const faq = jsonLdOfType(html, "FAQPage");
  assert.ok(breadcrumbs, `${areaFixture.slug} BreadcrumbList renders`);
  assert.ok(faq, `${areaFixture.slug} FAQPage renders`);
  assert.equal(itemList.url, areaFixture.canonical, `${areaFixture.slug} ItemList canonical URL`);
  assert.equal(html.includes('"@type":"Review"'), false, "fixture does not synthesize Review schema");
  assert.equal(html.includes('"@type":"Rating"'), false, "fixture does not synthesize Rating schema");
  assert.equal(html.includes('"@type":"AggregateRating"'), false, "fixture does not synthesize AggregateRating schema");
  assert.doesNotMatch(html, /noindex|fake ranking/iu, "indexability and ranking copy are not fabricated");
}

// The actual template must omit optional editorial UI when no eligible data exists.
for (const areaFixture of fixture.areas) {
  const count = areaFixture.editorial ? areaFixture.publicShopCount - 1 : 3;
  const shops = Array.from({ length: count }, (_, index) => makeShop(areaFixture, index + 1));
  const html = renderToStaticMarkup(React.createElement(templateModule.AreaHubPageTemplate, {
    area: { id: areaFixture.termId, slug: areaFixture.slug, name: areaFixture.slug, count, acf: {} },
    allShops: shops,
    parentArea: { id: 2, slug: "osaka", name: "大阪", acf: {} },
  }));
  assert.doesNotMatch(html, /data-area-supporting-disclosure|data-area-supporting-content|data-area-depth=|調査データ・選び方を見る/, "missing editorial leaves no wrapper, heading, or spacing container");
  assert.doesNotMatch(html, /準備中|coming soon|placeholder/i, "no fabricated optional placeholder");
  assertInOrder(html, [["list", 'data-contract="shop-list"'], ["filter", 'data-contract="filter"'], ["comparison", 'data-contract="comparison"'], ["following", 'data-contract="following-content"'], ["faq", 'data-contract="faq"']]);
  for (const shop of shops) assert.ok(html.includes(`/shops/${shop.slug}/`), "existing shop links survive missing editorial");
}

// G is documentation-only in 01A. This guard prevents the candidate acceptance
// fixture from silently becoming a permanent RED implementation assertion.
assert.equal(fixture.optionalSlot01B.implemented, false);
assert.equal(fixture.optionalSlot01B.acceptance.length, 5);

console.log("area template v2 foundation contract checks passed");

// Reuse the same bounded actual-template fixture in the 01B slot contract.
export { fixture, makeShop, templateModule };
