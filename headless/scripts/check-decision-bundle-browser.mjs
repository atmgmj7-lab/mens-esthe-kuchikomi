import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const origin = process.env.DECISION_BUNDLE_BASE_URL ?? "http://127.0.0.1:3187";
const baselineOrigin = process.env.DECISION_BUNDLE_BASELINE_URL ?? "https://mens-esthe-kuchikomi.com";
const evidenceDir = process.env.DECISION_BUNDLE_EVIDENCE_DIR;
const parsedOrigin = new URL(origin);
assert.equal(parsedOrigin.protocol, "http:");
assert.ok(["127.0.0.1", "localhost"].includes(parsedOrigin.hostname));
assert.ok(evidenceDir, "DECISION_BUNDLE_EVIDENCE_DIR is required");
await fs.mkdir(evidenceDir, { recursive: true });

const widths = [320, 375, 390, 768, 1024, 1440];
const areas = [
  { slug: "shinosaka", cards: 58, itemList: 58, midnight: 22, line: 19 },
  { slug: "sakai", cards: 25, itemList: 25, midnight: 9, line: 5 },
];
const browser = await chromium.launch({ headless: true });
let checks = 0;
const scenarios = [];
const equal = (actual, expected, message) => { checks += 1; assert.deepEqual(actual, expected, message); };
const ok = (actual, message) => { checks += 1; assert.ok(actual, message); };

function overlap(a, b) {
  return a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function seoState(page) {
  return page.evaluate(() => {
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.textContent || "null"));
    return {
      title: document.title,
      h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim()),
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
      schemas,
    };
  });
}

async function overflow(page) {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
}

async function baselineFor(route, root) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const response = await page.goto(`${baselineOrigin}${route}`, { waitUntil: "domcontentloaded" });
  equal(response?.status(), 200, `${route} baseline HTTP 200`);
  await page.locator(root).first().waitFor({ state: "visible" });
  const seo = await seoState(page);
  await page.close();
  return seo;
}

async function discoverShopRoutes() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${origin}/area/shinosaka/`, { waitUntil: "domcontentloaded" });
  await page.locator("#shop-list [data-area-shop-card=true]").first().waitFor({ state: "visible" });
  const routeForId = async (id) => page.locator(`#shop-list [data-area-shop-card=true]:has([data-area-comparison-shop="${id}"]) a[href^="/shops/"]`).first().getAttribute("href");
  const first = await routeForId(712);
  const second = await routeForId(768);
  await page.goto(`${origin}/area/sakai/`, { waitUntil: "domcontentloaded" });
  await page.locator("#shop-list [data-area-shop-card=true]").first().waitFor({ state: "visible" });
  const sakai = await page.locator("#shop-list [data-area-shop-card=true] a[href^='/shops/']").first().getAttribute("href");
  await page.close();
  ok(first && second && sakai, "three canonical shop routes discovered from Area DOM");
  return [
    { id: 712, route: first },
    { id: 768, route: second },
    { id: "sakai-representative", route: sakai },
  ];
}

try {
  const shopRoutes = await discoverShopRoutes();

  for (const area of areas) {
    const route = `/area/${area.slug}/`;
    const baseline = await baselineFor(route, "#shop-list [data-area-shop-card=true]");
    for (const width of widths) {
      const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block", viewport: { width, height: 800 } });
      const page = await context.newPage();
      const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      equal(response?.status(), 200, `${area.slug} ${width} HTTP 200`);
      await page.locator("#shop-list [data-area-shop-card=true]").first().waitFor({ state: "visible" });
      equal(await seoState(page), baseline, `${area.slug} ${width} SEO/schema exact parity`);
      ok(!((await response?.headerValue("x-robots-tag")) ?? "").includes("noindex"), `${area.slug} ${width} no X-Robots noindex`);
      const state = await page.evaluate(() => {
        const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent || "null"));
        const itemLists = [];
        const visit = (value) => {
          if (!value || typeof value !== "object") return;
          if (value["@type"] === "ItemList") itemLists.push(value);
          Object.values(value).forEach(visit);
        };
        schemas.forEach(visit);
        const cards = [...document.querySelectorAll("#shop-list [data-area-shop-card=true]")];
        const list = itemLists.find((item) => item.numberOfItems === cards.length);
        return {
          cards: cards.length,
          reviewLinks: cards.filter((card) => card.querySelector('[data-review-prefill="natural"]')).length,
          itemList: list?.itemListElement?.length ?? 0,
          positions: list?.itemListElement?.map((item) => item.position) ?? [],
          midnight: document.querySelectorAll("[data-after-midnight-shop]").length,
          line: document.querySelectorAll("[data-verified-line-shop]").length,
        };
      });
      equal(state.cards, area.cards, `${area.slug} ${width} natural count`);
      equal(state.reviewLinks, area.cards, `${area.slug} ${width} natural review links`);
      equal(state.itemList, area.itemList, `${area.slug} ${width} ItemList count`);
      equal(state.positions, Array.from({ length: area.itemList }, (_, index) => index + 1), `${area.slug} ${width} contiguous ItemList`);
      equal(state.midnight, area.midnight, `${area.slug} ${width} after-midnight`);
      equal(state.line, area.line, `${area.slug} ${width} LINE`);
      ok((await overflow(page)) <= 1, `${area.slug} ${width} no horizontal overflow`);

      const toggles = page.locator("#shop-list [data-area-comparison-control=true]:visible");
      await toggles.nth(0).focus();
      await page.keyboard.press("Space");
      await toggles.nth(1).click();
      const launcher = page.locator("[data-area-comparison-launcher=true]");
      const opener = launcher.locator("[data-area-comparison-open=true]");
      await opener.click();
      const dialog = page.locator("[data-area-comparison-dialog=true]");
      equal(await dialog.isVisible(), true, `${area.slug} ${width} dialog visible`);
      equal(await dialog.locator("[data-area-comparison-field]").count(), 6, `${area.slug} ${width} deferred rows hidden`);
      equal(await dialog.locator('[data-review-prefill="comparison"]').count(), 2, `${area.slug} ${width} comparison review links`);
      equal(await page.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow]), ["hidden", "hidden"], `${area.slug} ${width} body scroll locked`);
      ok((await overflow(page)) <= 1, `${area.slug} ${width} dialog no horizontal overflow`);
      if ((area.slug === "shinosaka" && [320, 1440].includes(width)) || (area.slug === "sakai" && width === 390)) {
        await page.screenshot({ path: path.join(evidenceDir, `area-${area.slug}-${width}-dialog.png`), fullPage: false });
      }
      await page.keyboard.press("Escape");
      equal(await opener.evaluate((node) => node === document.activeElement), true, `${area.slug} ${width} Escape restores focus`);
      await page.locator(".hl-footer-copy").scrollIntoViewIfNeeded();
      equal(overlap(await launcher.boundingBox(), await page.locator(".hl-footer-copy").boundingBox()), false, `${area.slug} ${width} launcher clears footer content`);
      equal(overlap(await launcher.boundingBox(), await page.locator(".hl-back-to-top").boundingBox()), false, `${area.slug} ${width} launcher clears top control`);
      scenarios.push({ kind: "area", route, width, js: true, pass: true });
      await context.close();
    }

    const noJs = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", viewport: { width: 390, height: 800 } });
    const page = await noJs.newPage();
    const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
    equal(response?.status(), 200, `${area.slug} no-JS HTTP 200`);
    await page.locator("#shop-list [data-area-shop-card=true]").first().waitFor({ state: "visible" });
    equal(await page.locator("#shop-list [data-area-shop-card=true]").count(), area.cards, `${area.slug} no-JS natural count`);
    equal(await page.locator("[data-area-comparison-control=true]:visible").count(), 0, `${area.slug} no-JS controls hidden`);
    await page.locator("#shop-list [data-area-shop-card=true]").last().scrollIntoViewIfNeeded();
    equal(await page.locator("#shop-list [data-area-shop-card=true]").last().isVisible(), true, `${area.slug} no-JS last card reachable`);
    ok((await overflow(page)) <= 1, `${area.slug} no-JS no overflow`);
    scenarios.push({ kind: "area", route, width: 390, js: false, pass: true });
    await noJs.close();
  }

  for (const shop of shopRoutes) {
    const baseline = await baselineFor(shop.route, "main[data-shop-detail-root]");
    const canonicalEncodedSlug = shop.route.split("/").filter(Boolean).at(-1);
    const reviewUrl = `/reviews/submit/?shop=${encodeURIComponent(canonicalEncodedSlug)}`;
    for (const width of widths) {
      const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block", viewport: { width, height: 800 } });
      const page = await context.newPage();
      const response = await page.goto(`${origin}${shop.route}`, { waitUntil: "domcontentloaded" });
      equal(response?.status(), 200, `${shop.id} ${width} Shop HTTP 200`);
      await page.locator("main[data-shop-detail-root]").waitFor({ state: "visible" });
      equal(await seoState(page), baseline, `${shop.id} ${width} Shop SEO/schema exact parity`);
      ok(!((await response?.headerValue("x-robots-tag")) ?? "").includes("noindex"), `${shop.id} ${width} Shop no X-Robots noindex`);
      ok((await overflow(page)) <= 1, `${shop.id} ${width} Shop no overflow`);
      const reviewLinks = page.locator(`a[href="${reviewUrl}"]`);
      ok(await reviewLinks.count() > 0, `${shop.id} ${width} Shop review prefill link`);
      const clipped = await page.locator('[data-shop-cta-position]:visible').evaluateAll((nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1 || rect.width < 1 || rect.height < 1;
      }).length);
      equal(clipped, 0, `${shop.id} ${width} Shop CTA clipping 0`);
      scenarios.push({ kind: "shop", route: shop.route, width, js: true, pass: true });
      await context.close();
    }

    const noJs = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", viewport: { width: 390, height: 800 } });
    const page = await noJs.newPage();
    const response = await page.goto(`${origin}${shop.route}`, { waitUntil: "domcontentloaded" });
    equal(response?.status(), 200, `${shop.id} Shop no-JS HTTP 200`);
    await page.locator("main[data-shop-detail-root]").waitFor({ state: "visible" });
    ok(await page.locator(`a[href="${reviewUrl}"]`).count() > 0, `${shop.id} Shop no-JS review link`);
    ok((await overflow(page)) <= 1, `${shop.id} Shop no-JS no overflow`);
    scenarios.push({ kind: "shop", route: shop.route, width: 390, js: false, pass: true });
    await noJs.close();

    for (const width of widths) {
      const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block", viewport: { width, height: 800 } });
      const page = await context.newPage();
      const response = await page.goto(`${origin}${reviewUrl}`, { waitUntil: "domcontentloaded" });
      equal(response?.status(), 200, `${shop.id} ${width} prefilled review HTTP 200`);
      await page.locator(".hl-review-form__shop").waitFor({ state: "visible" });
      ok((await page.locator(".hl-review-form__shop").textContent())?.includes("投稿先店舗："), `${shop.id} ${width} target visibly confirmed`);
      equal(await page.locator("#review-rating-total").inputValue(), "", `${shop.id} ${width} rating remains empty`);
      equal(await page.locator("#review-body").inputValue(), "", `${shop.id} ${width} body remains empty`);
      equal(await page.locator("link[rel=canonical]").getAttribute("href"), `${baselineOrigin}/reviews/submit/`, `${shop.id} ${width} query-free canonical`);
      ok(((await page.locator('meta[name="robots"]').getAttribute("content")) ?? "").includes("noindex"), `${shop.id} ${width} review noindex`);
      ok((await overflow(page)) <= 1, `${shop.id} ${width} review no overflow`);
      scenarios.push({ kind: "review-prefill", route: reviewUrl, width, js: true, pass: true });
      await context.close();
    }
  }

  for (const width of widths) {
    const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block", viewport: { width, height: 800 } });
    const page = await context.newPage();
    const response = await page.goto(`${origin}/reviews/submit/`, { waitUntil: "domcontentloaded" });
    equal(response?.status(), 200, `direct review ${width} HTTP 200`);
    await page.locator("#review-shop-select").waitFor({ state: "visible" });
    equal(await page.locator(".hl-review-form__shop").count(), 0, `direct review ${width} has no prefill`);
    ok((await overflow(page)) <= 1, `direct review ${width} no overflow`);
    scenarios.push({ kind: "review-direct", route: "/reviews/submit/", width, js: true, pass: true });
    await context.close();
  }

  const invalid = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const invalidResponse = await invalid.goto(`${origin}/reviews/submit?shop=missing-shop`, { waitUntil: "domcontentloaded" });
  equal(invalidResponse?.status(), 200, "invalid prefill falls back with HTTP 200");
  await invalid.locator("#review-shop-select").waitFor({ state: "visible" });
  equal(await invalid.locator(".hl-contact-error").count(), 0, "invalid prefill has no dead-end error");
  scenarios.push({ kind: "review-invalid", route: "/reviews/submit?shop=missing-shop", width: 390, js: true, pass: true });
  await invalid.close();

  const noJsReview = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", viewport: { width: 390, height: 800 } });
  const noJsReviewPage = await noJsReview.newPage();
  const noJsReviewResponse = await noJsReviewPage.goto(`${origin}/reviews/submit/`, { waitUntil: "domcontentloaded" });
  equal(noJsReviewResponse?.status(), 200, "direct review no-JS HTTP 200");
  await noJsReviewPage.locator("#review-shop-select").waitFor({ state: "visible" });
  scenarios.push({ kind: "review-direct", route: "/reviews/submit/", width: 390, js: false, pass: true });
  await noJsReview.close();

  const report = { pass: true, checks, scenarios: scenarios.length, widths, shopRoutes, results: scenarios };
  await fs.writeFile(path.join(evidenceDir, "decision-bundle-browser-qa.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: true, checks, scenarios: scenarios.length, shopRoutes }));
} finally {
  await browser.close();
}
