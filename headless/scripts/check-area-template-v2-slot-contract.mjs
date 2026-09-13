import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import { fixture, makeShop, templateModule } from "./check-area-template-v2-foundation-contract.mjs";

const baselinePath = new URL("./fixtures/area-template-v2-empty-slot-baseline.json", import.meta.url);
const hash = value => createHash("sha256").update(value).digest("hex");
const examples = [...fixture.areas, { ...fixture.areas[2], termId: 99, slug: "umeda", fixtureKey: "nonprecision-umeda" }];
const render = (example, extra = {}) => renderToStaticMarkup(React.createElement(templateModule.AreaHubPageTemplate, {
  area: { id: example.termId, slug: example.slug, name: example.slug, count: example.publicShopCount ?? 3, acf: {} },
  allShops: Array.from({ length: example.publicShopCount ?? 3 }, (_, i) => makeShop(example, i + 1)),
  parentArea: { id: 2, slug: "osaka", name: "大阪", acf: {} },
  ...extra,
}));
const empty = Object.fromEntries(examples.map(example => [example.fixtureKey ?? example.slug, render(example)]));
if (process.argv.includes("--capture-before")) {
  // Explicit baseline capture only; normal verification never updates this fixture.
  await writeFile(baselinePath, JSON.stringify({ templateBase: "e18de64df6da98866e32881dc7d6e373106f61da", htmlSha256: Object.fromEntries(Object.entries(empty).map(([key, html]) => [key, hash(html)])) }, null, 2) + "\n");
  console.log("Captured pre-slot whole-template HTML hashes");
  process.exit(0);
}
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const routes = new Map();
let checks = 0;
function equal(actual, expected, label) { checks++; assert.deepEqual(actual, expected, label); }
function Dummy() { return React.createElement("section", { "data-slot-fixture": "after-comparison" }, React.createElement("h2", null, "Slot fixture"), React.createElement("p", null, "SSR fixture content")); }
const dummy = React.createElement(Dummy);
const dummyHtml = renderToStaticMarkup(dummy);
for (const example of examples) {
  const key = example.fixtureKey ?? example.slug;
  const base = empty[key];
  equal(hash(base), baseline.htmlSha256[key], `${key} omitted slot preserves complete accepted HTML`);
  for (const slots of [undefined, {}, { afterComparison: undefined }, { afterComparison: null }, { afterComparison: false }, { afterComparison: 0 }, { afterComparison: "placeholder" }, { afterComparison: {} }]) {
    equal(render(example, { slots }), base, `${key} absent/invalid slot creates no DOM of any kind`);
  }
  const populated = render(example, { slots: { afterComparison: dummy } });
  equal(populated.split(dummyHtml).length - 1, 1, `${key} populated slot renders exactly once in SSR`);
  equal(populated.replace(dummyHtml, ""), base, `${key} removing only fixture leaves identical SEO/schema/H1/modules/anchors`);
  const comparison = '<section data-contract="comparison"></section>';
  equal(populated.includes(comparison + dummyHtml), true, `${key} fixture directly follows comparison`);
  const following = example.termId === 99 ? "latest-reviews" : "promotion";
  equal(populated.includes(dummyHtml + `<section data-contract="${following}">`), true, `${key} fixture directly precedes existing branch`);
  routes.set(`/${key}/`, populated);
}
const server = http.createServer((request, response) => {
  const html = request.method === "GET" ? routes.get(request.url) : null;
  response.writeHead(html ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html ? `<!doctype html><html><head><title>Local slot fixture</title></head><body>${html}</body></html>` : "");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await context.route("**/*", route => route.request().method() === "GET" && new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const route of routes.keys()) {
    const page = await context.newPage();
    const response = await page.goto(origin + route);
    equal(response.status(), 200, `${route} fixture HTTP200`);
    const node = page.locator('[data-slot-fixture="after-comparison"]');
    equal(await node.count(), 1, `${route} no-JS once`);
    equal(await node.isVisible(), true, `${route} no-JS visible`);
    equal(await node.textContent(), "Slot fixtureSSR fixture content", `${route} no-JS SSR text`);
    await page.close();
  }
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ pass: true, checks, fixtures: examples.length, noJs: routes.size, productionConnection: false }));
