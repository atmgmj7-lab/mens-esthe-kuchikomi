#!/usr/bin/env node

import assert from "node:assert/strict";
import { detectGa4, extractScriptUrls } from "./seo-cutover-check.mjs";

const base = "https://example.test";
const ga4Chunk = "/_next/static/immutable/chunks/ga4-loader.js?dpl=preview";

function htmlWithChunkUrls(urls) {
  return urls.map((url) => `<script defer src='${url}'></script>`).join("\n");
}

function createFetch(bodiesByUrl) {
  return async (url) => ({
    ok: Object.hasOwn(bodiesByUrl, url),
    text: async () => bodiesByUrl[url] ?? ""
  });
}

const placementVariants = htmlWithChunkUrls([
  "/_next/static/chunks/legacy.js?cache=1",
  ga4Chunk
]);

assert.deepEqual(extractScriptUrls(placementVariants, base), [
  "https://example.test/_next/static/chunks/legacy.js?cache=1",
  "https://example.test/_next/static/immutable/chunks/ga4-loader.js?dpl=preview"
]);

const immutableResult = await detectGa4(
  placementVariants,
  base,
  createFetch({
    "https://example.test/_next/static/chunks/legacy.js?cache=1": "window.__legacy = true;",
    "https://example.test/_next/static/immutable/chunks/ga4-loader.js?dpl=preview": "https://www.googletagmanager.com/gtag/js"
  })
);
assert.equal(immutableResult.ok, true, "immutable chunk 内の gtag/js を検出する");

const requiredChunks = Array.from(
  { length: 13 },
  (_, index) => `/_next/static/immutable/chunks/${index}.js`
);
const finalChunkUrl = `https://example.test${requiredChunks.at(-1)}`;
const finalChunkResult = await detectGa4(
  htmlWithChunkUrls(requiredChunks),
  base,
  createFetch({ [finalChunkUrl]: "const measurementId = 'G-6XFMW5XKBW';" })
);
assert.equal(finalChunkResult.ok, true, "13件目以降の必要 chunk も確認する");

const noTagResult = await detectGa4(
  htmlWithChunkUrls(["/_next/static/immutable/chunks/no-ga.js"]),
  base,
  createFetch({ "https://example.test/_next/static/immutable/chunks/no-ga.js": "console.info('no analytics');" })
);
assert.equal(noTagResult.ok, false, "GA4 タグなし fixture は失敗し続ける");

console.log("SEO cutover GA4 detector contract checks passed.");
