import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:3147";
const output = path.resolve(process.env.FIVE_AREA_PAGINATION_OUTPUT ?? "reports/five-area-pagination.json");
const baselineFile = process.env.FIVE_AREA_PAGINATION_BEFORE;
const rows = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const slug of ["umeda", "sakaisujihonmachi", "nihonbashi", "shinosaka", "sakai", "osaka"]) {
    for (const query of ["", "?page=2", "?page=invalid", "?page=9999"]) {
      const url = `${base}/area/${slug}/${query}`;
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000) });
      const html = await response.text();
      const context = await browser.newContext({ serviceWorkers: "block" });
      await context.route("**/*", route => {
        if (route.request().method() !== "GET") return route.abort();
        if (new URL(route.request().url()).origin !== base && !["image", "stylesheet", "font", "media"].includes(route.request().resourceType())) return route.abort();
        return route.continue();
      });
      try {
        const raw = await context.newPage();
        await raw.route("**/*", route => route.abort());
        // Parse raw server HTML without executing its hydration scripts.
        const rawEvidence = await raw.evaluate(html => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          return {
            title: doc.title,
            description: doc.querySelector('meta[name="description"]')?.content,
            canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
            robots: [...doc.querySelectorAll('meta[name="robots"]')].map(n => n.content),
            h1: [...doc.querySelectorAll("h1")].map(n => n.textContent),
            schemas: [...doc.querySelectorAll('script[type="application/ld+json"]')].map(n => JSON.parse(n.textContent)),
            cards: [...doc.querySelectorAll('[data-area-shop-card="true"]')].map(n => ({ href: n.querySelector('a[href*="/shops/"]')?.getAttribute("href"), text: n.textContent })),
          };
        }, html);
        await raw.close();
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__areaScrolls = [];
          const original = Element.prototype.scrollIntoView;
          Element.prototype.scrollIntoView = function (...args) {
            window.__areaScrolls.push(this.id);
            return original.apply(this, args);
          };
        });
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const expectsScroll = ["umeda", "sakaisujihonmachi", "nihonbashi"].includes(slug) && ["?page=2", "?page=9999"].includes(query);
        if (expectsScroll) await page.waitForFunction(() => window.__areaScrolls.includes("shop-list"), undefined, { timeout: 15000 });
        const row = { slug, query, status: response.status, location: response.headers.get("location"), ...rawEvidence, expectedScroll: expectsScroll,
          scrollObserved: expectsScroll ? await page.evaluate(() => window.__areaScrolls.includes("shop-list")) : null };
        rows.push(row);
      } finally { await context.close(); }
    }
  }
  for (const query of ["", "?page=2"]) {
    const response = await fetch(`${base}/area/sakaisuji-hommachi/${query}`, { redirect: "manual" });
    rows.push({ slug: "sakaisuji-hommachi", query, status: response.status, location: response.headers.get("location") });
  }
} finally { await browser.close(); }
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(rows, null, 2));
if (baselineFile) assert.deepEqual(JSON.parse(JSON.stringify(rows)), JSON.parse(await fs.readFile(baselineFile, "utf8")), "pagination raw SEO/schema/cards and scroll semantics unchanged");
console.log(JSON.stringify({ scenarios: rows.length, baselineCompared: Boolean(baselineFile), pass: true }));
