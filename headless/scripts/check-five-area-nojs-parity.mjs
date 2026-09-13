import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

// Run against a local production build, before and after the routing change.
const base = new URL(process.env.FIVE_AREA_BASE_URL ?? "http://127.0.0.1:3147");
assert.equal(base.hostname, "127.0.0.1", "loopback only");
const output = path.resolve(process.env.FIVE_AREA_REPORT_DIR ?? "reports/five-area-nojs-parity");
await fs.mkdir(output, { recursive: true });
const slugs = ["umeda", "sakaisujihonmachi", "nihonbashi", "shinosaka", "sakai"];
const rows = [];
const failures = [];
function check(value, label) { if (!value) failures.push(label); }
const browser = await chromium.launch({ headless: true });
try {
  for (const slug of slugs) {
    const url = new URL(`/area/${slug}/`, base).href;
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    await fs.writeFile(path.join(output, `${slug}.html`), html);
    await fs.writeFile(path.join(output, `${slug}.json`), JSON.stringify({ url, status: response.status, headers: Object.fromEntries(response.headers) }));
    check(response.status === 200, `${slug} SSR HTTP`);
    check(html.includes('data-area-shop-card="true"'), `${slug} SSR cards`);
    for (const width of [390, 1280]) {
      let jsIds;
      for (const javaScriptEnabled of [true, false]) {
        const context = await browser.newContext({ javaScriptEnabled, serviceWorkers: "block", viewport: { width, height: 900 } });
        await context.route("**/*", route => {
          const request = route.request();
          if (request.method() !== "GET") return route.abort();
          if (new URL(request.url()).origin !== base.origin && !["image", "stylesheet", "font", "media"].includes(request.resourceType())) return route.abort();
          return route.continue();
        });
        try {
          const page = await context.newPage();
          const document = await page.goto(url, { waitUntil: "domcontentloaded" });
          const cards = page.locator('[data-area-shop-card="true"]');
          await cards.first().waitFor({ state: "attached", timeout: 15000 });
          if (javaScriptEnabled) await cards.first().waitFor({ state: "visible", timeout: 15000 });
          // Do not remove hidden attributes or override display/visibility.
          const evidence = await cards.evaluateAll(nodes => ({
            ids: nodes.map(n => n.querySelector('a[href*="/shops/"]')?.getAttribute("href")),
            visible: nodes.filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden").length,
            hiddenAncestors: nodes.map(n => {
              const result = [];
              for (let p = n; p; p = p.parentElement) {
                if (p.hidden || getComputedStyle(p).display === "none") result.push({ tag: p.tagName, id: p.id, hidden: p.hidden, display: getComputedStyle(p).display });
              }
              return result;
            }),
          }));
          const pilot = ["shinosaka", "sakai"].includes(slug);
          const disclosure = page.locator('[data-area-supporting-disclosure="true"]');
          check(await disclosure.count() === (pilot ? 1 : 0), `${slug}/${width}/${javaScriptEnabled} disclosure count`);
          if (pilot) {
            check(await disclosure.evaluate(n => !n.open), `${slug}/${width}/${javaScriptEnabled} disclosure closed`);
            await disclosure.locator("summary").click();
            check(await disclosure.evaluate(n => n.open), `${slug}/${width}/${javaScriptEnabled} native disclosure opens`);
          }
          const row = { slug, url, width, javaScriptEnabled, http: document.status(), count: evidence.ids.length, ...evidence,
            pprMarkers: (html.match(/id="S:/g) ?? []).length,
            suspenseMarkers: (html.match(/<!--\$[?!]?-->/g) ?? []).length,
            fallback: await page.locator('.hl-route-fallback').count() };
          rows.push(row);
          await fs.writeFile(path.join(output, `${slug}-${width}-${javaScriptEnabled ? "js" : "nojs"}.dom.html`), await page.content());
          check(row.http === 200, `${slug}/${width}/${javaScriptEnabled} HTTP`);
          check(row.count > 0 && evidence.ids.every(Boolean), `${slug}/${width}/${javaScriptEnabled} identities`);
          check(evidence.visible > 0, `${slug}/${width}/${javaScriptEnabled} visible cards`);
          check(!evidence.hiddenAncestors.some(ancestors => ancestors.some(n => n.id.startsWith("S:"))), `${slug}/${width}/${javaScriptEnabled} hidden PPR`);
          if (javaScriptEnabled) jsIds = evidence.ids;
          else check(JSON.stringify(jsIds) === JSON.stringify(evidence.ids), `${slug}/${width} JS/noJS identity/order parity`);
          if (pilot) check(row.count === (slug === "shinosaka" ? 58 : 25), `${slug} pilot count`);
        } catch (error) {
          failures.push(`${slug}/${width}/${javaScriptEnabled}: ${error.message}`);
        } finally { await context.close(); }
      }
    }
  }
} finally { await browser.close(); }
const report = { rows, failures, scenarios: rows.length, pass: rows.length === 20 && failures.length === 0 };
await fs.writeFile(path.join(output, "result.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ scenarios: report.scenarios, failures, pass: report.pass }));
process.exitCode = report.pass ? 0 : 1;
