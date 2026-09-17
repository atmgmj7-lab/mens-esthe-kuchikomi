import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const origin = process.env.AREA_COMPARISON_BASE_URL ?? "http://127.0.0.1:3187";
const baselineOrigin = process.env.AREA_COMPARISON_BASELINE_URL ?? "https://mens-esthe-kuchikomi.com";
const evidenceDir = process.env.AREA_COMPARISON_EVIDENCE_DIR;
const parsedOrigin = new URL(origin);
assert.equal(parsedOrigin.protocol, "http:", "local comparison QA must use HTTP");
assert.ok(["127.0.0.1", "localhost"].includes(parsedOrigin.hostname), "local comparison QA must use loopback");
assert.ok(evidenceDir, "AREA_COMPARISON_EVIDENCE_DIR is required");
await fs.mkdir(evidenceDir, { recursive: true });

const fixtures = [
  { slug: "shinosaka", cards: 58, midnight: 22, line: 19, featured: [712, 768] },
  { slug: "sakai", cards: 25, midnight: 9, line: 5, featured: [] },
];
const widths = [320, 390, 1440];
const browser = await chromium.launch({ headless: true });
let checks = 0;
const scenarios = [];
const equal = (actual, expected, message) => {
  checks += 1;
  assert.deepEqual(actual, expected, message);
};
const ok = (value, message) => {
  checks += 1;
  assert.ok(value, message);
};

async function waitForArea(page) {
  await page.locator("#shop-list [data-area-shop-card=true]").first().waitFor({ state: "visible" });
}

async function readPageState(page) {
  return page.evaluate(() => {
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.textContent || "null"));
    const itemLists = [];
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (value["@type"] === "ItemList") itemLists.push(value);
      Object.values(value).forEach(visit);
    };
    schemas.forEach(visit);
    const cards = [...document.querySelectorAll("#shop-list [data-area-shop-card=true]")];
    return {
      seo: {
        title: document.title,
        h1: [...document.querySelectorAll("h1")].map((node) => node.textContent),
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
        schemas,
      },
      naturalIds: cards.map((card) => Number(card.querySelector("[data-area-comparison-shop]")?.getAttribute("data-area-comparison-shop"))),
      naturalLinks: cards.map((card) => card.querySelector('a[href^="/shops/"]')?.getAttribute("href")),
      cardCount: cards.length,
      itemListCount: itemLists.find((item) => item.numberOfItems === cards.length)?.itemListElement?.length ?? 0,
      itemListPositions: itemLists.find((item) => item.numberOfItems === cards.length)?.itemListElement?.map((item) => item.position) ?? [],
      midnight: document.querySelectorAll("[data-after-midnight-shop]").length,
      line: document.querySelectorAll("[data-verified-line-shop]").length,
      featured: [...document.querySelectorAll("[data-editorial-featured-shop]")]
        .map((node) => Number(node.getAttribute("data-editorial-featured-shop"))),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    };
  });
}

function rectanglesOverlap(left, right) {
  return left && right
    && left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

try {
  for (const fixture of fixtures) {
    const baselinePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const baselineResponse = await baselinePage.goto(`${baselineOrigin}/area/${fixture.slug}/`, { waitUntil: "domcontentloaded" });
    equal(baselineResponse?.status(), 200, `${fixture.slug} production baseline HTTP 200`);
    await waitForArea(baselinePage);
    const baseline = await readPageState(baselinePage);
    await baselinePage.close();

    for (const width of widths) {
      const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`${origin}/area/${fixture.slug}/`, { waitUntil: "domcontentloaded" });
      equal(response?.status(), 200, `${fixture.slug} ${width}px HTTP 200`);
      await waitForArea(page);

      const initial = await readPageState(page);
      equal(initial.seo, baseline.seo, `${fixture.slug} ${width}px exact SEO metadata/schema parity`);
      equal(initial.naturalLinks, baseline.naturalLinks, `${fixture.slug} ${width}px natural links unchanged`);
      equal(initial.cardCount, fixture.cards, `${fixture.slug} ${width}px card count`);
      equal(initial.itemListCount, fixture.cards, `${fixture.slug} ${width}px ItemList count`);
      equal(initial.itemListPositions, Array.from({ length: fixture.cards }, (_, index) => index + 1), `${fixture.slug} ${width}px contiguous ItemList`);
      equal(initial.midnight, fixture.midnight, `${fixture.slug} ${width}px after-midnight count`);
      equal(initial.line, fixture.line, `${fixture.slug} ${width}px LINE count`);
      equal(initial.featured, fixture.featured, `${fixture.slug} ${width}px editorial featured`);
      ok(initial.overflow <= 1, `${fixture.slug} ${width}px initial horizontal overflow 0`);

      const naturalToggles = page.locator("#shop-list [data-area-comparison-control=true]:visible");
      ok(await naturalToggles.count() >= 4, `${fixture.slug} ${width}px has four visible candidates`);
      const firstToggle = naturalToggles.nth(0);
      const firstBox = await firstToggle.boundingBox();
      ok(firstBox && firstBox.height >= 44, `${fixture.slug} ${width}px comparison target is at least 44px high`);
      await firstToggle.focus();
      await page.keyboard.press("Space");
      equal(await firstToggle.getAttribute("aria-pressed"), "true", `${fixture.slug} ${width}px keyboard selection`);
      await naturalToggles.nth(1).click();

      const launcher = page.locator("[data-area-comparison-launcher=true]");
      const opener = launcher.locator("[data-area-comparison-open=true]");
      equal(await launcher.isVisible(), true, `${fixture.slug} ${width}px launcher visible`);
      equal(await opener.isEnabled(), true, `${fixture.slug} ${width}px two shops enable comparison`);
      equal((await opener.textContent())?.trim(), "2店舗を比較", `${fixture.slug} ${width}px two-shop CTA`);
      await opener.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator("[data-area-comparison-dialog=true]");
      equal(await dialog.isVisible(), true, `${fixture.slug} ${width}px dialog opens`);
      equal(await dialog.locator("[data-area-comparison-detail]").count(), 2, `${fixture.slug} ${width}px selected shops only`);
      equal(await dialog.locator("[data-area-comparison-detail]:visible").count(), 2, `${fixture.slug} ${width}px detail CTAs remain visible`);
      equal(await dialog.locator("[data-area-comparison-field]").count(), 6, `${fixture.slug} ${width}px approved comparison fields`);
      equal((await dialog.textContent()).includes("料金"), false, `${fixture.slug} ${width}px price excluded`);
      equal((await dialog.textContent()).includes("Web予約"), false, `${fixture.slug} ${width}px web booking excluded`);
      equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "閉じる", `${fixture.slug} ${width}px focus enters dialog`);
      const detailHrefs = await dialog.locator("[data-area-comparison-detail]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
      ok(detailHrefs.every((href) => /^\/shops\/[^/]+\/$/.test(href || "")), `${fixture.slug} ${width}px detail links are valid`);
      await dialog.getByRole("button", { name: "閉じる" }).click();
      equal(await opener.evaluate((node) => node === document.activeElement), true, `${fixture.slug} ${width}px focus returns to opener`);
      await opener.click();
      await page.keyboard.press("Escape");
      equal(await dialog.isVisible(), false, `${fixture.slug} ${width}px Escape closes dialog`);
      equal(await opener.evaluate((node) => node === document.activeElement), true, `${fixture.slug} ${width}px Escape restores focus`);

      await naturalToggles.nth(2).click();
      equal((await opener.textContent())?.trim(), "3店舗を比較", `${fixture.slug} ${width}px third shop selected`);
      await naturalToggles.nth(3).click();
      equal(await launcher.getByRole("status").textContent(), "比較は3店舗までです", `${fixture.slug} ${width}px fourth shop rejected explicitly`);
      equal(await naturalToggles.nth(3).getAttribute("aria-pressed"), "false", `${fixture.slug} ${width}px fourth shop remains unselected`);
      await launcher.locator("li button").first().click();
      equal((await opener.textContent())?.trim(), "2店舗を比較", `${fixture.slug} ${width}px remove works`);
      await launcher.getByRole("button", { name: "すべて解除" }).click();
      equal(await launcher.isVisible(), false, `${fixture.slug} ${width}px clear all hides launcher`);

      if (fixture.featured.length > 0) {
        const featuredToggle = page.locator(`[data-area-comparison-location=featured][data-area-comparison-shop="${fixture.featured[0]}"]`);
        await featuredToggle.click();
        const sameShopToggles = page.locator(`[data-area-comparison-shop="${fixture.featured[0]}"]`);
        equal(await sameShopToggles.count(), 2, `${fixture.slug} ${width}px featured/natural duplicate locations`);
        equal(await sameShopToggles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-pressed"))), ["true", "true"], `${fixture.slug} ${width}px featured/natural state sync`);
        await page.locator(`[data-area-comparison-location=featured][data-area-comparison-shop="${fixture.featured[1]}"]`).click();
        equal(await opener.isEnabled(), true, `${fixture.slug} ${width}px featured pair can compare`);
      } else {
        equal(await page.locator("[data-area-comparison-location=featured]").count(), 0, `${fixture.slug} ${width}px no featured controls`);
        await naturalToggles.nth(0).click();
        await naturalToggles.nth(1).click();
      }

      await page.evaluate(() => window.scrollTo(0, 1200));
      const launcherBox = await launcher.boundingBox();
      const backToTop = page.locator(".hl-back-to-top");
      const backToTopBox = await backToTop.boundingBox();
      equal(rectanglesOverlap(launcherBox, backToTopBox), false, `${fixture.slug} ${width}px fixed controls do not overlap`);
      const finalState = await readPageState(page);
      equal(finalState.seo, initial.seo, `${fixture.slug} ${width}px selection leaves SEO/schema unchanged`);
      equal(finalState.naturalIds, initial.naturalIds, `${fixture.slug} ${width}px selection leaves natural order unchanged`);
      ok(finalState.overflow <= 1, `${fixture.slug} ${width}px selected horizontal overflow 0`);
      if (fixture.slug === "shinosaka" && (width === 320 || width === 1440)) {
        await page.screenshot({ path: path.join(evidenceDir, `comparison-${fixture.slug}-${width}.png`), fullPage: false });
      }
      scenarios.push({ slug: fixture.slug, width, javaScriptEnabled: true, pass: true });
      await context.close();
    }

    const noJsContext = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    const noJsPage = await noJsContext.newPage();
    await noJsPage.setViewportSize({ width: 390, height: 900 });
    const noJsResponse = await noJsPage.goto(`${origin}/area/${fixture.slug}/`, { waitUntil: "domcontentloaded" });
    equal(noJsResponse?.status(), 200, `${fixture.slug} no-JS HTTP 200`);
    await waitForArea(noJsPage);
    const noJsState = await readPageState(noJsPage);
    equal(noJsState.cardCount, fixture.cards, `${fixture.slug} no-JS all cards remain`);
    equal(noJsState.itemListCount, fixture.cards, `${fixture.slug} no-JS ItemList remains`);
    equal(await noJsPage.locator("[data-area-comparison-control=true]:visible").count(), 0, `${fixture.slug} no-JS controls hidden`);
    await noJsPage.locator("#shop-list [data-area-shop-card=true]").last().scrollIntoViewIfNeeded();
    equal(await noJsPage.locator("#shop-list [data-area-shop-card=true]").last().isVisible(), true, `${fixture.slug} no-JS last card reachable`);
    ok(noJsState.overflow <= 1, `${fixture.slug} no-JS horizontal overflow 0`);
    scenarios.push({ slug: fixture.slug, width: 390, javaScriptEnabled: false, pass: true });
    await noJsContext.close();
  }
} finally {
  await browser.close();
}

const report = { pass: true, checks, scenarios: scenarios.length, results: scenarios };
await fs.writeFile(path.join(evidenceDir, "browser-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
