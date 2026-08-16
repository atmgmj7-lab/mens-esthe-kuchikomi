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

assert.ok(existsSync(pathFor("app/reviews/page.tsx")), "/reviews/ route must exist");
const reviewsPageSource = read("app/reviews/page.tsx");
assert.ok(
  reviewsPageSource.includes("<Suspense") && reviewsPageSource.includes("<ReviewsPageContent"),
  "/reviews/ runtime searchParams must stay behind a Cache Components Suspense boundary",
);

const hubModel = compileModule("lib/review-hub.ts");
const defaultQuery = hubModel.normalizeReviewHubQuery({});
assert.deepEqual(
  defaultQuery,
  { page: 1, q: "", area: "", hasQuery: false },
  "unfiltered hub must be the only index candidate",
);
const filteredQuery = hubModel.normalizeReviewHubQuery({
  page: "2",
  q: "  梅田   接客  ",
  area: "umeda",
});
assert.deepEqual(
  filteredQuery,
  { page: 2, q: "梅田 接客", area: "umeda", hasQuery: true },
  "query values must be normalized without creating a new landing-page identity",
);
assert.deepEqual(
  hubModel.reviewsHubMetadataState(filteredQuery),
  { canonicalPath: "/reviews/", robots: { index: false, follow: true } },
  "filtered hub URLs must canonicalize to /reviews/ and stay noindex, follow",
);
assert.deepEqual(
  hubModel.reviewsHubMetadataState(defaultQuery),
  { canonicalPath: "/reviews/", robots: { index: true, follow: true } },
  "the query-free hub may be indexed",
);

const reviews = [
  {
    id: 601,
    body: "梅田で接客が丁寧だったことを記録した承認済み口コミです。",
    submittedAt: "2026-08-16T09:00:00+09:00",
    ratings: { total: 5, price: 4, service: 5, cleanliness: 4 },
    shop: { id: 201, slug: "umeda-approved-shop", name: "梅田承認店舗" },
    areas: [
      { id: 20, slug: "osaka", name: "大阪" },
      { id: 21, slug: "umeda", name: "梅田" },
    ],
  },
  {
    id: 602,
    body: "新大阪で料金案内を確認した承認済み口コミです。",
    submittedAt: "2026-08-15T09:00:00+09:00",
    ratings: { total: null, price: null, service: null, cleanliness: null },
    shop: { id: 202, slug: "shinosaka-approved-shop", name: "新大阪承認店舗" },
    areas: [{ id: 22, slug: "shinosaka", name: "新大阪" }],
  },
];
assert.deepEqual(
  hubModel.filterReviewsForHub(reviews, filteredQuery).map((review) => review.id),
  [601],
  "area and text filters must match the approved public payload only",
);
assert.deepEqual(
  hubModel.filterReviewsForHub(reviews, { ...filteredQuery, q: "見つからない語" }),
  [],
  "unknown text must return an honest empty state",
);
assert.equal(
  hubModel.buildReviewHubPageUrl(3, { q: "梅田 接客", area: "umeda" }),
  "/reviews/?page=3&q=%E6%A2%85%E7%94%B0+%E6%8E%A5%E5%AE%A2&area=umeda",
  "pagination must remain one canonical hub with interaction query state",
);

const shopFixtures = [
  { id: 201, slug: "umeda-approved-shop", areaSlug: "umeda", terms: [{ slug: "umeda" }] },
  { id: 202, slug: "shinosaka-approved-shop", areaSlug: "shinosaka", terms: [{ slug: "shinosaka" }] },
];
assert.deepEqual(
  hubModel.filterReviewSubmitShops(shopFixtures, "umeda").map((shop) => shop.id),
  [201],
  "area context may prefilter the public shop selector without extending the backend payload",
);
assert.equal(
  "backendPayload" in hubModel.buildReviewSubmitSelection("umeda-approved-shop", "umeda"),
  false,
  "frontend selection must not invent area or therapist fields for the submission API",
);

const breadcrumb = hubModel.reviewsHubBreadcrumbJsonLd();
assert.equal(breadcrumb["@type"], "BreadcrumbList");
assert.deepEqual(
  breadcrumb.itemListElement.map((item) => item.name),
  ["TOP", "口コミ・体験"],
  "reviews hub breadcrumb must describe the visible canonical hierarchy",
);

const link = ({ href, children, ...props }) => React.createElement(
  "a",
  { href: typeof href === "string" ? href : String(href), ...props },
  children,
);
const css = new Proxy({}, { get: (_target, key) => String(key) });
const priorityAreas = compileModule("lib/priority-areas.ts");
const reviewCard = compileModule("components/reviews/ReviewCard.tsx", {
  "next/link": { __esModule: true, default: link },
  "./ReviewsHub.module.css": css,
});
const priorityAreaLinks = compileModule("components/reviews/PriorityAreaLinks.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/lib/priority-areas": priorityAreas,
});
const multiAreaCardHtml = renderToStaticMarkup(
  React.createElement(reviewCard.ReviewCard, { review: reviews[0] }),
);
assert.ok(multiAreaCardHtml.includes('href="/area/osaka/"'), "review card must link its first assigned area");
assert.ok(multiAreaCardHtml.includes('href="/area/umeda/"'), "review card must keep every assigned canonical area relation");
const reviewsHub = compileModule("components/reviews/ReviewsHub.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/components/reviews/PriorityAreaLinks": priorityAreaLinks,
  "@/components/reviews/ReviewCard": reviewCard,
  "@/lib/review-hub": hubModel,
  "./ReviewsHub.module.css": css,
});

const html = renderToStaticMarkup(
  React.createElement(reviewsHub.ReviewsHub, {
    reviews,
    total: 2,
    totalPages: 1,
    filters: defaultQuery,
    posts: [{
      id: 990,
      slug: "published-editorial",
      title: "公開済み編集部コラム",
      date: "2026-08-14T09:00:00+09:00",
      excerpt: "固有本文のある公開コラムです。",
    }],
  }),
);
assert.equal((html.match(/<h1\b/g) ?? []).length, 1, "reviews hub must have exactly one H1");
assert.ok(html.includes("関西メンズエステの口コミ・体験談"), "reviews hub must render the approved unique H1");
assert.ok(html.includes("梅田で接客が丁寧"), "approved review body must be present in SSR HTML");
assert.ok(html.includes('href="/reviews/submit/"'), "reviews hub must link to the existing submit route");
assert.ok(html.includes('href="/shops/umeda-approved-shop/"'), "review card must use the canonical shop relation");
assert.ok(html.includes('href="/area/umeda/"'), "review card must use the canonical area relation");
assert.ok(html.includes('href="/area/osaka/"'), "review card must keep every assigned canonical area relation");
assert.ok(html.includes('href="/column/published-editorial/"'), "formal published columns must stay a separate editorial module");
for (const slug of ["sakai", "shinosaka", "umeda", "sakaisujihonmachi", "nihonbashi"]) {
  assert.ok(html.includes(`href="/area/${slug}/"`), `reviews hub must link priority area ${slug}`);
}
for (const forbidden of [
  "参考になった口コミ",
  "店舗回答あり",
  "セラピスト個人口コミ",
  "体験確認済み",
  "AggregateRating",
]) {
  assert.equal(html.includes(forbidden), false, `unconfigured review capability must stay hidden: ${forbidden}`);
}

const emptyHtml = renderToStaticMarkup(
  React.createElement(reviewsHub.ReviewsHub, {
    reviews: [],
    total: 2,
    totalPages: 1,
    filters: { ...defaultQuery, q: "該当なし", hasQuery: true },
    posts: [],
  }),
);
assert.ok(emptyHtml.includes("条件に一致する口コミはありません"), "filtered empty state must be explicit");
assert.ok(emptyHtml.includes('href="/reviews/"'), "filtered empty state must offer a reset to the canonical hub");

console.log("Reviews hub contract: PASS");
