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

const link = ({ href, children, ...props }) => React.createElement(
  "a",
  { href: typeof href === "string" ? href : String(href), ...props },
  children,
);
const css = new Proxy({}, { get: (_target, key) => String(key) });

const updatesModel = compileModule("lib/home-updates.ts");
const reviews = [
  {
    id: 501,
    body: "梅田で利用した体験を、料金と接客の印象を含めて投稿しました。",
    submittedAt: "2026-08-16T09:00:00+09:00",
    ratings: { total: 5, price: 4, service: 5, cleanliness: 4 },
    shop: { id: 101, slug: "umeda-fixture", name: "梅田テスト店舗" },
    areas: [{ id: 11, slug: "umeda", name: "梅田" }],
  },
  {
    id: 502,
    body: "新大阪の店舗で受けた案内についての承認済み口コミです。",
    submittedAt: "2026-08-15T09:00:00+09:00",
    ratings: { total: null, price: null, service: null, cleanliness: null },
    shop: { id: 102, slug: "shinosaka-fixture", name: "新大阪テスト店舗" },
    areas: [{ id: 12, slug: "shinosaka", name: "新大阪" }],
  },
];
const posts = [
  {
    id: 901,
    slug: "editorial-fixture",
    link: "https://mens-esthe-kuchikomi.com/editorial-fixture/",
    title: "編集部が確認した店舗選びのポイント",
    date: "2026-08-14T10:00:00+09:00",
    modified: "2026-08-14T10:00:00+09:00",
    contentHtml: "",
    excerpt: "公開済みコラムの要約",
    imageUrl: "",
    terms: [],
    acf: {},
  },
];

const updateItems = updatesModel.buildHomeUpdates({
  reviews: [...reviews, reviews[0]],
  posts: [...posts, { ...posts[0], id: 902, date: "invalid" }],
});
assert.deepEqual(
  updateItems.map((item) => item.id),
  ["review:501", "review:502", "column:901"],
  "updates must sort real dated items, reject invalid dates, and deduplicate canonical IDs",
);
assert.deepEqual(
  [...new Set(updateItems.map((item) => item.category))].sort(),
  ["column", "review"],
  "updates must expose only available review and column categories",
);
assert.equal(
  updateItems.some((item) => ["schedule", "therapist", "coupon"].includes(item.category)),
  false,
  "unconfigured update categories must stay absent",
);

const priorityAreas = compileModule("lib/priority-areas.ts");
const prioritySlugs = priorityAreas.PRIORITY_AREAS.map((area) => area.slug);
assert.deepEqual(
  prioritySlugs,
  ["sakai", "shinosaka", "umeda", "sakaisujihonmachi", "nihonbashi"],
  "the five approved canonical area routes must remain distinct",
);

const reviewCard = compileModule("components/reviews/ReviewCard.tsx", {
  "next/link": { __esModule: true, default: link },
  "./ReviewsHub.module.css": css,
});
const priorityAreaLinks = compileModule("components/reviews/PriorityAreaLinks.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/lib/priority-areas": priorityAreas,
});
const homeSearch = compileModule("components/home/HomeShopSearch.tsx", {
  react: React,
});
const updatesHub = compileModule("components/home/UpdatesHub.tsx", {
  react: React,
  "next/link": { __esModule: true, default: link },
  "./UpdatesHub.module.css": css,
});
const ranking = compileModule("components/ranking/ScopedRankingModule.tsx", {
  "./ScopedRankingModule.module.css": css,
});
const boundary = compileModule("lib/ux-production-data-boundary.ts");
const rankingMarkup = renderToStaticMarkup(
  React.createElement(ranking.ScopedRankingModule, {
    availability: boundary.unavailableStrictRanking("overall"),
  }),
);
assert.equal(rankingMarkup, "", "storage-not-configured must render no ranking section or rank numbers");

const home = compileModule("components/HomePageContent.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/components/AreaFeatureSection": {
    AreaFeatureSection: () => React.createElement("section", null, "大阪の特集エリア"),
  },
  "@/components/KansaiAreaGrid": {
    KansaiAreaGrid: () => React.createElement("section", null, "人気エリアから探す"),
  },
  "@/components/common/ShopImageWithFallback": {
    ShopImageWithFallback: ({ src, ...props }) => React.createElement("img", src ? { src, ...props } : props),
  },
  "@/components/home/HomeShopSearch": homeSearch,
  "@/components/home/UpdatesHub": updatesHub,
  "@/components/ranking/ScopedRankingModule": ranking,
  "@/components/reviews/PriorityAreaLinks": priorityAreaLinks,
  "@/components/reviews/ReviewCard": reviewCard,
  "@/lib/home-updates": updatesModel,
  "@/lib/ux-production-data-boundary": boundary,
});

const html = renderToStaticMarkup(
  React.createElement(home.HomePageContent, {
    shopCount: 1,
    shops: [{
      id: 101,
      slug: "umeda-fixture",
      title: "梅田テスト店舗",
      imageUrl: "",
      areaSlug: "umeda",
      terms: [{ id: 11, slug: "umeda", name: "梅田", parent: 0, count: 1 }],
    }],
    areas: [{ id: 11, slug: "umeda", name: "梅田", parent: 0, count: 1, description: "", acf: {} }],
    areaFeatures: [],
    posts,
    reviewResult: {
      status: "available",
      page: { reviews, total: 2, totalPages: 1, page: 1 },
    },
    strictRanking: boundary.unavailableStrictRanking("overall"),
  }),
);

const orderedMarkers = [
  "関西メンズエステ口コミナビ",
  "知りたいことから探す",
  "新着口コミ・体験",
  "関西メンズエステの最新情報",
  "重点エリアから探す",
  'id="home-updated-title">掲載店舗',
  "情報の出自を分けて掲載しています",
  "初めての方へ",
];
assert.match(html, /role="tabpanel"[^>]*aria-labelledby=/u, "Updates tabpanel must be named by its active tab");
let previous = -1;
for (const marker of orderedMarkers) {
  const current = html.indexOf(marker);
  assert.ok(current >= 0, `home SSR must include ${marker}`);
  assert.ok(current > previous, `home SSR must place ${marker} in the approved semantic order`);
  previous = current;
}

for (const url of [
  "/images/home-hero/osaka-night-alley-lanterns.jpg",
  "/images/home-hero/kansai-night-station-street.jpg",
  "/images/home-hero/kansai-night-food-street.webp",
  "/images/home-hero/osaka-night-sign-street.jpg",
  "/images/home-hero/osaka-senba-night-road.jpg",
]) {
  assert.ok(html.includes(url), `existing hero asset must remain: ${url}`);
}
for (const slug of prioritySlugs) {
  assert.ok(html.includes(`href="/area/${slug}/"`), `home must crawlably link priority area ${slug}`);
}
assert.ok(html.includes("梅田で利用した体験"), "approved review copy must be present in home SSR HTML");
assert.ok(html.includes('href="/reviews/"'), "home must link to the reviews hub");
assert.ok(html.includes('href="/reviews/submit/"'), "home must link to the existing submit route");
for (const forbidden of [
  "さかいひがし 温泉",
  "初心者向け</strong>",
  "参考になった口コミ",
  "店舗回答あり",
  "セラピスト個人口コミ",
]) {
  assert.equal(html.includes(forbidden), false, `home must not render unavailable or fictional UI: ${forbidden}`);
}
assert.equal((html.match(/<h1\b/g) ?? []).length, 1, "home must keep exactly one H1");

console.log("Home UX production contract: PASS");
