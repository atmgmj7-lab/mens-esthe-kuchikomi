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

const wpPosts = [
  {
    id: 1,
    slug: "hello-world",
    type: "post",
    status: "publish",
    categories: [1],
    link: "https://mens-esthe-kuchikomi.com/hello-world/",
    date: "2026-08-18T09:00:00+09:00",
    modified: "2026-08-18T09:00:00+09:00",
    title: { rendered: "A deliberately unrelated title" },
    content: { rendered: "A deliberately unrelated body" },
    excerpt: { rendered: "A deliberately unrelated excerpt" },
  },
  {
    id: 101,
    slug: "osaka-editorial-a",
    type: "post",
    status: "publish",
    categories: [1],
    link: "https://mens-esthe-kuchikomi.com/osaka-editorial-a/",
    date: "2026-08-17T09:00:00+09:00",
    modified: "2026-08-17T09:00:00+09:00",
    title: { rendered: "Hello world! を題名に含む正式コラム" },
    content: { rendered: "正式なコラム本文 A" },
    excerpt: { rendered: "正式なコラム概要 A" },
  },
  {
    id: 102,
    slug: "osaka-editorial-b",
    type: "post",
    status: "publish",
    categories: [7],
    link: "https://mens-esthe-kuchikomi.com/osaka-editorial-b/",
    date: "2026-08-16T09:00:00+09:00",
    modified: "2026-08-16T09:00:00+09:00",
    title: { rendered: "正式コラム B" },
    content: { rendered: "正式なコラム本文 B" },
    excerpt: { rendered: "正式なコラム概要 B" },
  },
  {
    id: 103,
    slug: "osaka-editorial-c",
    type: "post",
    status: "publish",
    categories: [8],
    link: "https://mens-esthe-kuchikomi.com/osaka-editorial-c/",
    date: "2026-08-15T09:00:00+09:00",
    modified: "2026-08-15T09:00:00+09:00",
    title: { rendered: "正式コラム C" },
    content: { rendered: "正式なコラム本文 C" },
    excerpt: { rendered: "正式なコラム概要 C" },
  },
  {
    id: 104,
    slug: "osaka-editorial-d",
    type: "post",
    status: "publish",
    categories: [9],
    link: "https://mens-esthe-kuchikomi.com/osaka-editorial-d/",
    date: "2026-08-14T09:00:00+09:00",
    modified: "2026-08-14T09:00:00+09:00",
    title: { rendered: "正式コラム D" },
    content: { rendered: "正式なコラム本文 D" },
    excerpt: { rendered: "正式なコラム概要 D" },
  },
  {
    id: 105,
    slug: "osaka-editorial-e",
    type: "post",
    status: "publish",
    categories: [10],
    link: "https://mens-esthe-kuchikomi.com/osaka-editorial-e/",
    date: "2026-08-13T09:00:00+09:00",
    modified: "2026-08-13T09:00:00+09:00",
    title: { rendered: "正式コラム E" },
    content: { rendered: "正式なコラム本文 E" },
    excerpt: { rendered: "正式なコラム概要 E" },
  },
  {
    id: 106,
    slug: "osaka-editorial-f",
    type: "post",
    status: "publish",
    categories: [11],
    link: "https://mens-esthe-kuchikomi.com/osaka-editorial-f/",
    date: "2026-08-12T09:00:00+09:00",
    modified: "2026-08-12T09:00:00+09:00",
    title: { rendered: "正式コラム F" },
    content: { rendered: "正式なコラム本文 F" },
    excerpt: { rendered: "正式なコラム概要 F" },
  },
];

const normalizePost = (post) => ({
  id: post.id,
  slug: post.slug,
  link: post.link,
  title: post.title.rendered,
  date: post.date,
  modified: post.modified,
  contentHtml: post.content.rendered,
  excerpt: post.excerpt.rendered,
  imageUrl: null,
  terms: [],
  acf: {},
});
const postsReader = compileModule("lib/wp/posts.ts", {
  "@/lib/wp/client": {
    wpFetch: async (path) => {
      const request = new URL(path, "https://mens-esthe-kuchikomi.com");
      const perPage = Number(request.searchParams.get("per_page"));
      return wpPosts.slice(0, perPage).map((post) => ({ ...post }));
    },
  },
  "next/cache": { cacheLife: () => {}, cacheTag: () => {} },
  "@/lib/wp/normalize": { normalizePost },
  "@/lib/wp/build-resilience": { logWpBuildFallback: () => {} },
});

const topPosts = await postsReader.getLatestPosts(6);
const reviewsPosts = await postsReader.getLatestPosts(6);
const expectedPostIdentities = [
  { id: 101, slug: "osaka-editorial-a", link: "https://mens-esthe-kuchikomi.com/osaka-editorial-a/" },
  { id: 102, slug: "osaka-editorial-b", link: "https://mens-esthe-kuchikomi.com/osaka-editorial-b/" },
  { id: 103, slug: "osaka-editorial-c", link: "https://mens-esthe-kuchikomi.com/osaka-editorial-c/" },
  { id: 104, slug: "osaka-editorial-d", link: "https://mens-esthe-kuchikomi.com/osaka-editorial-d/" },
  { id: 105, slug: "osaka-editorial-e", link: "https://mens-esthe-kuchikomi.com/osaka-editorial-e/" },
  { id: 106, slug: "osaka-editorial-f", link: "https://mens-esthe-kuchikomi.com/osaka-editorial-f/" },
];

assert.deepEqual(
  topPosts.map(({ id, slug, link }) => ({ id, slug, link })),
  expectedPostIdentities,
  "the WordPress default sample identity must be excluded without dropping valid generic published posts or changing their order",
);
assert.deepEqual(
  reviewsPosts.map(({ id, slug, link }) => ({ id, slug, link })),
  expectedPostIdentities,
  "Top and Reviews must receive the same shared filtered editorial reader output",
);

const homeUpdates = compileModule("lib/home-updates.ts");
const topUpdateItems = homeUpdates.buildHomeUpdates({
  reviews: [],
  posts: topPosts,
});
assert.deepEqual(
  topUpdateItems.map((item) => item.id),
  ["column:101", "column:102", "column:103", "column:104", "column:105", "column:106"],
  "Top updates must fill the requested six valid columns in order and never count the leading sample toward the limit",
);

const link = ({ href, children, ...props }) => React.createElement(
  "a",
  { href: typeof href === "string" ? href : String(href), ...props },
  children,
);
const css = new Proxy({}, { get: (_target, key) => String(key) });
const reviewHubModel = compileModule("lib/review-hub.ts");
const reviewsHub = compileModule("components/reviews/ReviewsHub.tsx", {
  "next/link": { __esModule: true, default: link },
  "@/components/reviews/PriorityAreaLinks": { PriorityAreaLinks: () => null },
  "@/components/reviews/ReviewCard": { ReviewCard: () => null },
  "@/lib/review-hub": reviewHubModel,
  "./ReviewsHub.module.css": css,
});
const reviewsHtml = renderToStaticMarkup(
  React.createElement(reviewsHub.ReviewsHub, {
    reviews: [],
    total: 0,
    totalPages: 1,
    filters: reviewHubModel.normalizeReviewHubQuery({}),
    posts: reviewsPosts,
    availability: "available",
  }),
);
assert.ok(reviewsHtml.includes("全0件"), "filtering editorial posts must preserve the zero-review count");
assert.ok(reviewsHtml.includes("現在表示できる承認済み口コミはありません"), "filtering editorial posts must preserve the zero-review empty state");
assert.equal(reviewsHtml.includes("A deliberately unrelated title"), false, "Reviews must not render the default sample post");
assert.ok(reviewsHtml.includes("正式コラム B"), "Reviews must preserve valid generic published columns");

console.log("Editorial placeholder contract: PASS");
