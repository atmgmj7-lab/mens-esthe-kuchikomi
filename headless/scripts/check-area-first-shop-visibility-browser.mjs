import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const baseUrl = process.env.AREA_VISIBILITY_BASE_URL ?? "http://127.0.0.1:3117";
const mode = process.env.AREA_VISIBILITY_MODE === "baseline" ? "baseline" : "after";
const expectedBaseSha = "7cf39fb4dbd45a820d5ca9e0b17b7097464a91a1";
const sourceSha = process.env.AREA_VISIBILITY_SOURCE_SHA
  ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const reportRoot = path.resolve(process.env.AREA_VISIBILITY_REPORT_DIR ?? "reports/area-first-shop-visibility-hotfix-01");
const beforeReportPath = process.env.AREA_VISIBILITY_BEFORE_REPORT
  ? path.resolve(process.env.AREA_VISIBILITY_BEFORE_REPORT)
  : path.join(reportRoot, "baseline.json");
const reportPath = path.join(reportRoot, `${mode}.json`);
const screenshotDir = path.join(reportRoot, "screenshots");
const widths = [1440, 1280, 1024, 901, 900, 390, 375, 320];
const fixtures = [
  {
    slug: "shinosaka",
    label: "新大阪",
    publicShopCount: 58,
    beforeY: { 1440: 3176, 390: 4381 },
    supportingTokens: ["公開58店舗", "30件", "51.7%", "編集部の横断確認データ", "192名", "22店舗"],
  },
  {
    slug: "sakai",
    label: "堺東",
    publicShopCount: 25,
    beforeY: { 1440: 3203, 390: 4407 },
    supportingTokens: ["公開25店舗", "11件", "44%", "編集部の横断確認データ", "63名", "6店舗"],
  },
];

const failures = [];
const measurements = [];
const seo = {};
const screenshotFiles = [];
let assertions = 0;

function check(condition, label, details = {}) {
  assertions += 1;
  if (!condition) failures.push({ label, details });
}

function collectTypes(value, types = []) {
  if (!value || typeof value !== "object") return types;
  if (typeof value["@type"] === "string") types.push(value["@type"]);
  for (const nested of Object.values(value)) collectTypes(nested, types);
  return types;
}

function normalizeItemList(schema) {
  return {
    ...schema,
    itemListElement: [...schema.itemListElement]
      .map(({ position: _position, ...item }) => item)
      .sort((left, right) => left.url.localeCompare(right.url, "ja")),
  };
}

function normalizeHtmlText(html) {
  return html.replace(/<!--[\s\S]*?-->|<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function supportingSsrText(html, runMode) {
  const shopListAttribute = html.indexOf('id="shop-list"');
  const end = html.lastIndexOf("<", shopListAttribute);
  const marker = runMode === "baseline"
    ? "escomi-final-area-content-shell\""
    : 'data-area-supporting-content="true"';
  const markerIndex = html.indexOf(marker);
  const start = html.indexOf(">", markerIndex) + 1;
  assert.ok(markerIndex >= 0 && start > markerIndex && end > start, `supporting SSR range must exist in ${runMode}`);
  return normalizeHtmlText(html.slice(start, end));
}

async function saveScreenshot(page, file) {
  await fs.rm(file, { force: true });
  await page.screenshot({ path: file, fullPage: true });
  screenshotFiles.push(file);
}

await fs.mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const fixture of fixtures) {
    for (const width of widths) {
      const height = width <= 390 ? 844 : 900;
      const page = await browser.newPage({ viewport: { width, height } });
      const response = await page.goto(`${baseUrl}/area/${fixture.slug}/`, { waitUntil: "domcontentloaded" });
      check(response?.status() === 200, `${fixture.slug} ${width}px HTTP 200`, { status: response?.status() });
      await page.addStyleTag({
        content: "*,*::before,*::after{animation:none!important;transition:none!important}.hl-fade-in{opacity:1!important;transform:none!important}",
      });

      const geometry = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      check(
        geometry.bodyScrollWidth <= geometry.clientWidth + 1 && geometry.documentScrollWidth <= geometry.clientWidth + 1,
        `${fixture.slug} ${width}px horizontal overflow=0`,
        geometry,
      );

      const firstShop = page.locator('#shop-list [data-area-shop-card="true"]').first();
      await firstShop.waitFor({ state: "visible", timeout: 30_000 });
      const firstShopBox = await firstShop.boundingBox();
      check(Boolean(firstShopBox), `${fixture.slug} ${width}px first shop card exists`);
      const disclosure = page.locator('details[data-area-supporting-disclosure="true"]');
      const summary = disclosure.locator("summary");
      const disclosureCount = await disclosure.count();
      const isOpen = disclosureCount === 1 ? await disclosure.evaluate((node) => node.open) : null;
      const summaryBox = disclosureCount === 1 ? await summary.boundingBox() : null;

      if (mode === "after") {
        check(disclosureCount === 1, `${fixture.slug} ${width}px has one supporting disclosure`, { disclosureCount });
        check(isOpen === false, `${fixture.slug} ${width}px disclosure collapsed by default`, { isOpen });
        check((summaryBox?.height ?? 0) >= 44, `${fixture.slug} ${width}px summary target >=44px`, { summaryBox });
        if (disclosureCount === 1) {
          await summary.focus();
          const focusStyle = await summary.evaluate((node) => {
            const style = getComputedStyle(node);
            return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
          });
          check(
            focusStyle.outlineStyle !== "none" && Number.parseFloat(focusStyle.outlineWidth) >= 2,
            `${fixture.slug} ${width}px focus visible`,
            focusStyle,
          );
          await summary.press("Enter");
          check(await disclosure.evaluate((node) => node.open), `${fixture.slug} ${width}px Enter opens disclosure`);
          check(
            await disclosure.locator('[data-area-depth="coverage"]').isVisible(),
            `${fixture.slug} ${width}px expanded supporting content is visible`,
          );
          const expandedGeometry = await page.evaluate(() => ({
            bodyScrollWidth: document.body.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          check(
            expandedGeometry.bodyScrollWidth <= expandedGeometry.clientWidth + 1
              && expandedGeometry.documentScrollWidth <= expandedGeometry.clientWidth + 1,
            `${fixture.slug} ${width}px expanded horizontal overflow=0`,
            expandedGeometry,
          );
          if (width === 1440 || width === 390) {
            await saveScreenshot(page, path.join(screenshotDir, `after-expanded-${fixture.slug}-${width}.png`));
          }
          await summary.press("Space");
          check(!(await disclosure.evaluate((node) => node.open)), `${fixture.slug} ${width}px Space closes disclosure`);
          if (width === 1440) {
            await summary.click();
            check(await disclosure.evaluate((node) => node.open), `${fixture.slug} ${width}px pointer click opens disclosure`);
            await summary.click();
            check(!(await disclosure.evaluate((node) => node.open)), `${fixture.slug} ${width}px second pointer click closes disclosure`);
          }
        }
      }

      if ((width === 1440 || width === 390) && firstShopBox) {
        const expectedMax = fixture.beforeY[width] * 0.5;
        if (mode === "after") {
          check(firstShopBox.y <= expectedMax, `${fixture.slug} ${width}px first shop Y reduced >=50%`, {
            beforeY: fixture.beforeY[width],
            afterY: firstShopBox.y,
            expectedMax,
          });
        }
      }

      if (width === 1440 || width === 390) {
        await saveScreenshot(page, path.join(screenshotDir, `${mode}-${fixture.slug}-${width}.png`));
      }

      measurements.push({
        slug: fixture.slug,
        width,
        firstShopY: firstShopBox?.y ?? null,
        overflow: Math.max(geometry.bodyScrollWidth, geometry.documentScrollWidth) - geometry.clientWidth,
        disclosureCount,
        disclosureOpen: isOpen,
        summaryHeight: summaryBox?.height ?? null,
      });
      await page.close();
    }

    const rawResponse = await fetch(`${baseUrl}/area/${fixture.slug}/`);
    const rawHtml = await rawResponse.text();
    const normalizedSupportingSsrText = supportingSsrText(rawHtml, mode);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/area/${fixture.slug}/`, { waitUntil: "domcontentloaded" });
    await page.locator('#shop-list [data-area-shop-card="true"]').first().waitFor({ state: "visible", timeout: 30_000 });
    const pageEvidence = await page.evaluate((runMode) => {
      const normalize = (value) => value.replace(/\s+/g, " ").trim();
      const supportingContent = document.querySelector('[data-area-supporting-content="true"]');
      const contentShell = document.querySelector(".escomi-final-area-content-shell");
      const preShopChildren = contentShell
        ? [...contentShell.children].filter((node) => node.id !== "shop-list" && !node.previousElementSibling?.matches("#shop-list, #shop-list ~ *"))
        : [];
      return {
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
        h1: document.querySelector("h1")?.textContent?.trim() ?? "",
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
        supportingDomText: normalize(
          runMode === "after"
            ? supportingContent?.textContent ?? ""
            : preShopChildren.map((node) => node.textContent ?? "").join(""),
        ),
        shopCards: document.querySelectorAll('[data-area-shop-card="true"]').length,
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent ?? "null")),
      };
    }, mode);
    await page.close();
    const types = pageEvidence.jsonLd.flatMap((value) => collectTypes(value));
    const itemLists = pageEvidence.jsonLd.filter((value) => value?.["@type"] === "ItemList");
    const faqPages = pageEvidence.jsonLd.filter((value) => value?.["@type"] === "FAQPage");
    const breadcrumbLists = pageEvidence.jsonLd.filter((value) => value?.["@type"] === "BreadcrumbList");
    const seoEvidence = {
      title: pageEvidence.title,
      metaDescription: pageEvidence.metaDescription,
      h1: pageEvidence.h1,
      canonical: pageEvidence.canonical,
      robots: pageEvidence.robots,
      xRobotsTag: rawResponse.headers.get("x-robots-tag") ?? "",
      indexable: rawResponse.status === 200
        && !/noindex/i.test(`${pageEvidence.robots} ${rawResponse.headers.get("x-robots-tag") ?? ""}`),
      responseStatus: rawResponse.status,
      finalPath: new URL(rawResponse.url).pathname,
      supportingDomText: pageEvidence.supportingDomText,
      supportingSsrText: normalizedSupportingSsrText,
      breadcrumbList: breadcrumbLists,
      itemList: itemLists.map(normalizeItemList),
      faqPage: faqPages,
      jsonLdTypes: [...types].sort(),
      shopCards: pageEvidence.shopCards,
    };
    seo[fixture.slug] = seoEvidence;

    check(pageEvidence.shopCards === fixture.publicShopCount, `${fixture.slug} shop cards=${fixture.publicShopCount}`, { actual: pageEvidence.shopCards });
    check(itemLists.length === 1, `${fixture.slug} ItemList singular`, { actual: itemLists.length });
    check(itemLists[0]?.numberOfItems === fixture.publicShopCount, `${fixture.slug} ItemList count=${fixture.publicShopCount}`, { actual: itemLists[0]?.numberOfItems });
    check(itemLists[0]?.itemListElement?.length === fixture.publicShopCount, `${fixture.slug} ItemList elements=${fixture.publicShopCount}`, { actual: itemLists[0]?.itemListElement?.length });
    check(breadcrumbLists.length === 1, `${fixture.slug} BreadcrumbList unchanged`);
    check(faqPages.length === 1, `${fixture.slug} FAQPage unchanged`);
    check(!types.includes("Review") && !types.includes("Rating") && !types.includes("AggregateRating"), `${fixture.slug} review/rating schema absent`, { types });

    if (mode === "after") {
      check(/<details[^>]*data-area-supporting-disclosure="true"/i.test(rawHtml), `${fixture.slug} disclosure exists in SSR HTML`);
      check(!/<details[^>]*data-area-supporting-disclosure="true"[^>]*\sopen(?:=|\s|>)/i.test(rawHtml), `${fixture.slug} SSR disclosure is closed by default`);
      for (const token of fixture.supportingTokens) {
        check(normalizedSupportingSsrText.includes(token), `${fixture.slug} disclosure SSR retains ${token}`);
      }
      const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      const noJsPage = await noJsContext.newPage();
      const noJsResponse = await noJsPage.goto(`${baseUrl}/area/${fixture.slug}/`, { waitUntil: "load" });
      const noJsDisclosure = noJsPage.locator('details[data-area-supporting-disclosure="true"]');
      check(noJsResponse?.status() === 200, `${fixture.slug} JavaScript-disabled HTTP 200`);
      check(await noJsDisclosure.count() === 1, `${fixture.slug} JavaScript-disabled disclosure exists`);
      check(await noJsDisclosure.locator('[data-area-depth="coverage"]').count() === 1, `${fixture.slug} JavaScript-disabled coverage is disclosure child`);
      check(await noJsDisclosure.locator('[data-area-depth="portal-therapist"]').count() === 1, `${fixture.slug} JavaScript-disabled cross-source data is disclosure child`);
      const noJsSupportingText = normalizeHtmlText(await noJsDisclosure.locator('[data-area-supporting-content="true"]').textContent() ?? "");
      check(noJsSupportingText === pageEvidence.supportingDomText, `${fixture.slug} JavaScript-disabled supporting text is complete`);
      await noJsContext.close();
    }
  }

  if (mode === "after") {
    const beforeReport = JSON.parse(await fs.readFile(beforeReportPath, "utf8"));
    check(beforeReport.taskId === "AREA-FIRST-SHOP-VISIBILITY-HOTFIX-01", "baseline report task ID is valid");
    check(beforeReport.mode === "baseline", "baseline report mode is valid");
    check(beforeReport.sourceSha === expectedBaseSha, "baseline report source SHA is valid", { sourceSha: beforeReport.sourceSha });
    for (const fixture of fixtures) {
      assert.deepEqual(seo[fixture.slug], beforeReport.seo[fixture.slug], `${fixture.slug} SEO/schema evidence must remain byte-equivalent as JSON`);
      assertions += 1;
    }
    const nonTargetPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const nonTargetResponse = await nonTargetPage.goto(`${baseUrl}/area/umeda/`, { waitUntil: "domcontentloaded" });
    await nonTargetPage.locator('#shop-list [data-area-shop-card="true"]').first().waitFor({ state: "visible", timeout: 30_000 });
    check(nonTargetResponse?.status() === 200, "non-target umeda HTTP 200");
    check(await nonTargetPage.locator('details[data-area-supporting-disclosure="true"]').count() === 0, "non-target umeda disclosure=0");
    await nonTargetPage.close();
  }
} catch (error) {
  failures.push({ label: "browser contract completed", details: { message: String(error?.stack ?? error) } });
} finally {
  await browser.close();
}

const report = {
  taskId: "AREA-FIRST-SHOP-VISIBILITY-HOTFIX-01",
  mode,
  sourceSha,
  baseUrl,
  headless: true,
  generatedAt: new Date().toISOString(),
  assertions,
  measurements,
  seo,
  screenshots: screenshotFiles,
  failures,
};
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, assertions, failures: failures.length, measurements }, null, 2));
if (failures.length > 0) process.exitCode = 1;
