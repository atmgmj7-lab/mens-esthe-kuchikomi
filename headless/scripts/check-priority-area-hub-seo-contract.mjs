import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = process.cwd();
const pathFor = (file) => join(root, file);
const read = (file) => readFileSync(pathFor(file), "utf8");

function compileModule(file, requireMap = {}) {
  assert.ok(existsSync(pathFor(file)), `${file} must exist`);
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
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
    if (id === "react/jsx-runtime") return jsxRuntime;
    if (Object.hasOwn(requireMap, id)) return requireMap[id];
    throw new Error(`Unexpected require from ${file}: ${id}`);
  };
  new Function("require", "module", "exports", compiled.outputText)(
    localRequire,
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

const unavailable = Object.freeze({ status: "unavailable", reason: "request-failed" });
const loader = compileModule("lib/priority-area-hub.ts", {
  "@/lib/priority-area-precision": {
    isPriorityAreaPrecisionTarget: (area) => [17, 13, 7, 46, 4].includes(area.id),
  },
  "@/lib/wp/reviews": {
    getApprovedReviewsPage: async () => unavailable,
  },
});

const calls = [];
const reviewResult = Object.freeze({
  status: "available",
  page: Object.freeze({ reviews: Object.freeze([]), total: 0, totalPages: 0, page: 1 }),
});
const result = await loader.loadPriorityAreaApprovedReviews(
  { id: 13, slug: "shinosaka", name: "新大阪" },
  async (...args) => {
    calls.push(args);
    return reviewResult;
  },
);
assert.equal(result, reviewResult, "priority Area must return the accepted reader result without reshaping it");
assert.deepEqual(calls, [[1, 6, "shinosaka"]], "priority Area must request page 1, six reviews, and its canonical slug");

const nonPriorityCalls = [];
assert.equal(
  await loader.loadPriorityAreaApprovedReviews(
    { id: 99, slug: "nanba", name: "難波" },
    async (...args) => {
      nonPriorityCalls.push(args);
      return reviewResult;
    },
  ),
  null,
  "non-priority Area must keep the existing hub flow without a new review request",
);
assert.deepEqual(nonPriorityCalls, [], "non-priority Area must not invoke the priority reader");

const reviewLinks = compileModule("lib/review-links.ts");
assert.equal(
  reviewLinks.buildAreaReviewSubmitUrl("umeda"),
  "/reviews/submit/?area=umeda",
  "Area review CTA must reuse the existing frontend-only area prefilter",
);
assert.equal(
  reviewLinks.buildAreaReviewSubmitUrl("../unsafe"),
  "/reviews/submit/",
  "invalid Area context must fall back to the existing context-free submit route",
);

const link = ({ href, children, ...props }) => React.createElement(
  "a",
  { href: typeof href === "string" ? href : String(href), ...props },
  children,
);
const css = new Proxy({}, { get: (_target, key) => String(key) });
const reviewCard = compileModule("components/reviews/ReviewCard.tsx", {
  "next/link": { __esModule: true, default: link },
  "./ReviewsHub.module.css": css,
});
const areaLatestReviews = compileModule("components/area/AreaLatestReviews.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/components/reviews/ReviewCard": reviewCard,
  "@/lib/review-links": reviewLinks,
  "@/components/area/area-hub-content": { REVIEW_POLICY_SHORT: "承認済み口コミだけを掲載" },
  "@/components/area/hub/AreaHubThemeBanner": {
    AreaHubThemeBanner: ({ message }) => React.createElement("div", null, message),
  },
  "@/components/area/hub/AreaHubSectionHeader": {
    AreaHubSectionHeader: ({ ja }) => React.createElement("h2", null, ja),
  },
  "@/lib/area-hub-banner-config": { isLayeredBannerSectionEnabled: () => false },
  "@/components/area/hub/AreaHubSectionShell": {
    AreaHubSectionShell: ({ id, children }) => React.createElement("section", { id, "data-area-reviews": "true" }, children),
  },
  "@/lib/area-shop-utils": {
    shopReviewCount: (shop) => Number(shop.acf?.shop_review_count ?? 0),
  },
});

const reviews = [
  {
    id: 701,
    body: "新大阪で案内を受けたときの承認済み口コミ本文です。",
    submittedAt: "2026-08-16T09:00:00+09:00",
    ratings: { total: 5, price: 4, service: 5, cleanliness: 4 },
    shop: {
      id: 301,
      slug: "shinosaka-approved-shop",
      name: "新大阪承認店舗",
      primaryArea: { id: 13, slug: "shinosaka", name: "新大阪" },
    },
    areas: [{ id: 13, slug: "shinosaka", name: "新大阪" }],
  },
  {
    id: 702,
    body: "評価を付けずに投稿された公開可能な口コミです。",
    submittedAt: "2026-08-15T09:00:00+09:00",
    ratings: { total: null, price: null, service: null, cleanliness: null },
    shop: {
      id: 302,
      slug: "shinosaka-no-rating",
      name: "評価なし承認店舗",
      primaryArea: { id: 13, slug: "shinosaka", name: "新大阪" },
    },
    areas: [{ id: 13, slug: "shinosaka", name: "新大阪" }],
  },
];
const availableReviews = {
  status: "available",
  page: { reviews, total: 2, totalPages: 1, page: 1 },
};
const areaReviewsHtml = renderToStaticMarkup(React.createElement(areaLatestReviews.AreaLatestReviews, {
  reviewResult: availableReviews,
  hubContext: { slug: "shinosaka", name: "新大阪" },
}));
assert.ok(areaReviewsHtml.includes("新大阪で案内を受けたとき"), "approved review excerpt must exist in Area SSR HTML");
assert.ok(areaReviewsHtml.includes("承認済みユーザー口コミ"), "review provenance must remain visible");
assert.ok(areaReviewsHtml.includes('aria-label="総合評価 5／5"'), "valid rating must remain visible");
assert.equal((areaReviewsHtml.match(/aria-label="総合評価/gu) ?? []).length, 1, "missing rating must not become a fixed score");
assert.ok(areaReviewsHtml.includes('href="/shops/shinosaka-approved-shop/"'), "review must link its canonical Shop");
assert.ok(areaReviewsHtml.includes('href="/reviews/"'), "Area reviews must crawlably link the Reviews Hub");
assert.ok(areaReviewsHtml.includes('href="/reviews/submit/?area=shinosaka"'), "review CTA must carry only the existing frontend Area context");
assert.equal((areaReviewsHtml.match(/data-review-card="approved-user"/gu) ?? []).length, 2, "only returned approved reviews may render");

const emptyAreaReviewsHtml = renderToStaticMarkup(React.createElement(areaLatestReviews.AreaLatestReviews, {
  reviewResult: { status: "available", page: { reviews: [], total: 0, totalPages: 0, page: 1 } },
  hubContext: { slug: "shinosaka", name: "新大阪" },
}));
assert.equal(emptyAreaReviewsHtml, "", "zero reviews must not leave a large empty section or fake review");

const unavailableAreaReviewsHtml = renderToStaticMarkup(React.createElement(areaLatestReviews.AreaLatestReviews, {
  reviewResult: unavailable,
  hubContext: { slug: "shinosaka", name: "新大阪" },
}));
assert.equal(unavailableAreaReviewsHtml, "", "unavailable reviews must fail closed without a fake empty count");

const legacyAreaReviewsHtml = renderToStaticMarkup(React.createElement(areaLatestReviews.AreaLatestReviews, {
  shops: [{ id: 801, slug: "nanba-legacy-shop", title: "難波既存店舗", acf: { shop_review_count: 2 } }],
  hubContext: { slug: "nanba", name: "難波" },
}));
assert.ok(legacyAreaReviewsHtml.includes("難波既存店舗"), "non-priority Area must preserve its existing Shop review module");
assert.ok(legacyAreaReviewsHtml.includes("確認済み口コミ 2件"), "non-priority Area must preserve its legacy count label");

const areaHubConfig = compileModule("lib/area-hub-config.ts");
const expectedPrioritySeo = {
  sakaisujihonmachi: {
    title: "堺筋本町のメンズエステおすすめ一覧｜料金・深夜・口コミ比較",
    nearby: ["nihonbashi", "umeda"],
    localGuideTitle: "本町・北浜も候補にする",
  },
  shinosaka: {
    title: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較",
    nearby: ["umeda"],
    localGuideTitle: "西中島・東三国も候補にする",
  },
  nihonbashi: {
    title: "大阪・日本橋のメンズエステおすすめ一覧｜難波・近鉄日本橋で比較",
    nearby: ["sakaisujihonmachi"],
    localGuideTitle: "近鉄日本橋・なんばも確認する",
  },
  umeda: {
    title: "梅田のメンズエステおすすめ一覧｜大阪駅・北新地の料金・深夜比較",
    nearby: ["shinosaka", "sakaisujihonmachi"],
    localGuideTitle: "大阪駅・北新地も候補にする",
  },
  sakai: {
    title: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較",
    nearby: ["nihonbashi"],
    localGuideTitle: "堺市内の関連地域も確認する",
  },
};
const titles = [];
for (const [slug, expected] of Object.entries(expectedPrioritySeo)) {
  const seo = areaHubConfig.getHubTemplateConfig(slug)?.seo;
  assert.ok(seo, `${slug} priority SEO config must exist`);
  titles.push(seo.hubTitle);
  assert.equal(seo.hubTitle, expected.title, `${slug} must use its approved unique H1/title subject`);
  assert.ok(
    seo.hubDescription.length >= 80 && seo.hubDescription.length <= 140,
    `${slug} intro must stay within the evidence-safe 80-140 character target`,
  );
  assert.ok(Array.isArray(seo.faqItems) && seo.faqItems.length >= 3, `${slug} must have at least three visible Area-specific FAQ rows`);
  assert.deepEqual(
    seo.nearbyAreas.map((area) => area.slug),
    expected.nearby,
    `${slug} must link only its approved natural priority-Area neighbors`,
  );
  assert.equal(seo.nearbyAreas.some((area) => area.slug === slug), false, `${slug} must not link itself as a nearby Area`);
  assert.ok(
    seo.localGuide?.items.some((item) => item.title === expected.localGuideTitle),
    `${slug} must explain how users can compare its named nearby search areas`,
  );
  const serialized = JSON.stringify({
    intro: seo.hubDescription,
    guide: seo.localGuide,
    faq: seo.faqItems,
  });
  for (const forbidden of [
    "0円",
    "徒歩1分",
    "固定評価",
    "相場は",
    "必ず深夜営業",
    "Primary Area",
    "Area Hub",
    "Area relation",
    "canonical Area",
    "`/area",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${slug} must not publish unverified fact: ${forbidden}`);
  }
}
assert.equal(new Set(titles).size, 5, "the five priority Areas must have five distinct H1 values");

const areaPriorityLinks = compileModule("components/area/hub/AreaHubPriorityLinks.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/lib/review-links": reviewLinks,
});
const priorityLinksHtml = renderToStaticMarkup(React.createElement(areaPriorityLinks.AreaHubPriorityLinks, {
  hubContext: {
    slug: "shinosaka",
    name: "新大阪",
    nearbyAreas: [{ slug: "umeda", label: "梅田のメンズエステを見る" }],
  },
}));
assert.ok(priorityLinksHtml.includes('href="/"'), "priority Area must crawlably link Top");
assert.ok(priorityLinksHtml.includes('href="/reviews/"'), "priority Area must crawlably link Reviews Hub");
assert.ok(priorityLinksHtml.includes('href="/reviews/submit/?area=shinosaka"'), "priority Area must crawlably link its frontend-prefilled submit route");
assert.ok(priorityLinksHtml.includes('href="/area/umeda/"'), "priority Area must link its configured natural neighbor");
assert.equal(priorityLinksHtml.includes('href="/area/sakai/"'), false, "priority Area links must not become an indiscriminate five-Area mesh");

const decisionGuide = compileModule("components/area/hub/AreaHubDecisionGuide.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/lib/area-shop-utils": {
    aggregateReviewCountLabel: () => "口コミ募集中",
    hasPublishedPrice: () => false,
    isLateNightShop: () => false,
  },
  "@/lib/priority-area-precision": {
    priorityAreaFragmentAvailable: () => true,
  },
});
const guideContext = {
  slug: "shinosaka",
  name: "新大阪",
  decisionGuide: {
    intro: "新大阪で探す条件を先に整理します。",
    selectionTitle: "駅と時間から選ぶ",
  },
};
const decisionWithReviewsHtml = renderToStaticMarkup(React.createElement(decisionGuide.AreaHubDecisionGuide, {
  hubContext: guideContext,
  shops: [],
  precisionMode: true,
  capabilities: {},
  approvedReviewCount: 2,
}));
assert.ok(
  decisionWithReviewsHtml.includes("承認済み口コミ 2件"),
  "priority quick guide must use the approved Area reader count instead of legacy Shop ACF counts",
);
const decisionWithoutReviewsHtml = renderToStaticMarkup(React.createElement(decisionGuide.AreaHubDecisionGuide, {
  hubContext: guideContext,
  shops: [],
  precisionMode: true,
  capabilities: {},
  approvedReviewCount: 0,
}));
assert.equal(
  decisionWithoutReviewsHtml.includes("口コミを見る"),
  false,
  "priority quick guide must not link to an absent reviews section",
);

const areaPageSource = read("app/area/[slug]/page.tsx");
const areaHubRouteSource = read("components/area/AreaHubRouteContent.tsx");
assert.ok(
  areaPageSource.includes("renderAreaHubRouteContent")
    && areaHubRouteSource.includes("loadPriorityAreaApprovedReviews"),
  "the Area route must use the accepted primary-Area approved-review reader",
);
assert.ok(
  /areaReviewResult[\s\S]*?<AreaHubPageTemplate[\s\S]*?reviewResult=\{areaReviewResult\}/u.test(areaHubRouteSource),
  "the Area route must pass the approved review result to the hub template",
);

const templateSource = read("components/area/AreaHubPageTemplate.tsx");
for (const contract of [
  "reviewResult?: ApprovedGlobalReviewResult | null",
  "<AreaLatestReviews",
  "<AreaHubPriorityLinks",
]) {
  assert.ok(templateSource.includes(contract), `Area template must include ${contract}`);
}
const decisionPosition = templateSource.indexOf("<AreaHubDecisionGuide");
const reviewsPosition = templateSource.indexOf("<AreaLatestReviews");
const rankingPosition = templateSource.indexOf("<AreaHubRankingTop");
const shopsPosition = templateSource.indexOf('<AreaHubSectionShell theme="shop-list"');
const guidePosition = templateSource.indexOf("<AreaHubPriceAndGuideSections");
const faqPosition = templateSource.indexOf("<AreaFaqSection");
assert.ok(
  decisionPosition < reviewsPosition && reviewsPosition < rankingPosition && rankingPosition < shopsPosition && shopsPosition < guidePosition && guidePosition < faqPosition,
  "priority Area content order must be hero, decision guide, approved reviews, ranking, shops, guide, FAQ",
);
assert.ok(
  /precisionMode[\s\S]*?option\.id !== "reviews"/u.test(read("components/area/hub/AreaShopList.tsx")),
  "priority Area shop controls must not expose the legacy ACF-based reviews filter",
);
assert.ok(
  /precisionMode\s*\?\s*<AreaHubPriorityLinks[\s\S]*?:\s*\(\s*<AreaHubRelatedAreas/u.test(templateSource),
  "priority Areas must use curated internal links while generic Areas preserve existing relation links",
);
assert.ok(
  /\{!precisionMode\s*\?\s*\(\s*<AreaHubLocalGuideSection/u.test(templateSource),
  "non-priority Area must preserve its local guide before ranking",
);
assert.ok(
  /\{!precisionMode\s*\?\s*<AreaPromotionSection[\s\S]*?\/>\s*:\s*null\}/u.test(templateSource),
  "non-priority Area must preserve its promotion before the shop list",
);
assert.ok(
  /<AreaHubCompareTabsSections[\s\S]*?\{precisionMode\s*\?\s*\(\s*<AreaPromotionSection[\s\S]*?:\s*\(\s*<AreaLatestReviews\s+shops=\{mainShops\}/u.test(templateSource),
  "non-priority Area must preserve legacy reviews after compare while priority Areas keep promotion there",
);

console.log("Priority Area Hub SEO contract: PASS");
