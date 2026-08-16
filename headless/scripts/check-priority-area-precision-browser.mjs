import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  buildMinimalChildEnv,
  cleanupHarnessResources,
  copyTrackedProjectFiles,
  listTrackedProjectFiles,
  resolveBrowserReportDirectory,
  stopChildProcess,
} from "./lib/priority-area-browser-harness.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(projectRoot, "..");
const reportDir = await resolveBrowserReportDirectory({
  projectRoot,
  override: process.env.BROWSER_QA_REPORT_OWNER,
});
const screenshotDir = path.join(reportDir, "screenshots");
const port = 3113;
const baseUrl = `http://127.0.0.1:${port}`;
const fixtureOnly = process.env.BROWSER_QA_FIXTURE_ONLY === "1";
const headless = process.env.BROWSER_QA_HEADLESS === "1";
const viewports = [320, 375, 390, 760, 761, 900, 901, 1024, 1025, 1280, 1440]
  .map((width) => ({ width, height: width <= 390 ? 844 : width >= 1280 ? 1000 : 900 }));
const areas = [
  { id: 17, slug: "sakai", name: "堺東", h1: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較", nearby: ["nihonbashi"], exact: 6, related: 1, unclassified: 1 },
  { id: 13, slug: "shinosaka", name: "新大阪", h1: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較", nearby: ["umeda"], exact: 3, related: 1, unclassified: 1 },
  { id: 7, slug: "nihonbashi", name: "大阪日本橋", h1: "大阪・日本橋のメンズエステおすすめ一覧｜難波・近鉄日本橋で比較", nearby: ["sakaisujihonmachi"], exact: 12, related: 1, unclassified: 1 },
  { id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", h1: "堺筋本町のメンズエステおすすめ一覧｜料金・深夜・口コミ比較", nearby: ["nihonbashi", "umeda"], exact: 18, related: 2, unclassified: 1 },
  { id: 4, slug: "umeda", name: "梅田", h1: "梅田のメンズエステおすすめ一覧｜大阪駅・北新地の料金・深夜比較", nearby: ["shinosaka", "sakaisujihonmachi"], exact: 5, related: 2, unclassified: 1 },
];
const fixtureSourceFiles = [
  "components/area/hub/AreaHubPriorityLinks.tsx",
  "components/shop-detail/ShopRelatedLinks.tsx",
  "lib/priority-area-hub.ts",
  "lib/shop-detail-area.ts",
];

let scenarios = 0;
let assertions = 0;
let screenshotCount = 0;
const screenshotFiles = [];
const failures = [];

function check(condition, label, details = {}) {
  assertions += 1;
  if (!condition) failures.push({ label, details });
}

function fixtureRecord(record) {
  return {
    id: record.wpShopId,
    slug: record.shopSlug,
    title: record.shopName,
    primaryArea: {
      id: record.targetPrimaryArea.termId,
      slug: record.targetPrimaryArea.slug,
      name: record.targetPrimaryArea.label,
    },
    relations: record.currentAreaRelations.map((relation) => ({
      id: relation.termId,
      slug: relation.slug,
      name: relation.label,
    })),
  };
}

function buildFixtureData(preview) {
  const accepted = preview.records.map(fixtureRecord);
  return Object.fromEntries(areas.map((area) => {
    const related = {
      id: 900000 + area.id,
      slug: `related-${area.slug}`,
      title: "同名でも別IDの店舗",
      primaryArea: { id: 999, slug: "other", name: "別エリア" },
      relations: [{ id: area.id, slug: area.slug, name: area.name }],
    };
    const unclassified = {
      ...related,
      id: 910000 + area.id,
      slug: `unclassified-${area.slug}`,
      primaryArea: null,
    };
    const exactRecords = accepted.filter((record) => record.primaryArea.id === area.id);
    const fixtureRecords = accepted.map((record) => {
      const exactIndex = exactRecords.findIndex((exactRecord) => exactRecord.id === record.id);
      const namedRecord = exactIndex === 0 ? {
        ...record,
        title: `${area.name}のとても長い日本語店舗名でも折り返して表示できる確認用メンズエステ店舗`,
      } : record;
      if (area.slug !== "umeda" || exactIndex < 0) return namedRecord;
      if (exactIndex === 0) return {
        ...namedRecord,
        acf: { shop_station: "梅田駅", shop_walk_minutes: 3, shop_access: "汎用案内は表示しない" },
      };
      if (exactIndex === 1) return {
        ...namedRecord,
        acf: { shop_access: "大阪駅 徒歩1分", shop_price_60min: "10,000円" },
      };
      return namedRecord;
    });
    return [area.slug, {
      area,
      records: [...fixtureRecords, related, unclassified],
      legacyRankingEntries: exactRecords.map((record, index) => ({ shopSlug: record.slug, rank: index + 1 })),
      promotedShopId: exactRecords[0]?.id ?? null,
    }];
  }));
}

async function runCommand(command, args, cwd, timeoutMs = 180_000) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env: buildMinimalChildEnv(process.env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const remember = (chunk) => { output = `${output}${chunk}`.slice(-30_000); };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  let timeout;
  try {
    const code = await Promise.race([
      new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", resolve);
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${command} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    if (code !== 0) throw new Error(`${command} ${args.join(" ")} failed (${code})\n${output}`);
  } catch (error) {
    await stopChildProcess(child);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function harnessPageSource(fixtureData) {
  return `import { notFound } from "next/navigation";
import { AreaHubPageTemplate } from "@/components/area/AreaHubPageTemplate";
import { normalizeShopRanking } from "@/lib/shop-ranking";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import type { ApprovedGlobalReviewResult, AreaView, ShopView, WpTerm } from "@/lib/wp/types";

const fixtures = ${JSON.stringify(fixtureData)} as const;
export const instant = false;
type FixtureRecord = (typeof fixtures)[keyof typeof fixtures]["records"][number] & {
  readonly acf?: Readonly<Record<string, unknown>>;
};

function toTerm(record: { id: number; slug: string; name: string }): WpTerm {
  return { ...record, count: 1, parent: 2, taxonomy: "area" };
}

function toShop(record: FixtureRecord, promotedShopId: number | null): ShopView {
  const acf: Record<string, unknown> = {
    ranking_enabled: true,
    area_rank: 1,
    ...(record.acf ?? {}),
    ...(record.id === promotedShopId ? { is_pr: true } : {}),
  };
  return {
    id: record.id,
    slug: record.slug,
    link: \`https://mens-esthe-kuchikomi.com/shops/\${record.slug}/\`,
    title: record.title,
    contentHtml: "",
    excerpt: "",
    imageUrl: "",
    media: {
      cardSquare: { mediaId: null, source: "fallback", url: "", alt: record.title },
      detailBanner: null,
    },
    terms: record.relations.map(toTerm),
    acf,
    officialUrl: "",
    areaSlug: record.primaryArea?.slug ?? "",
    primaryArea: record.primaryArea,
    ranking: normalizeShopRanking(acf),
    strictRanking: unavailableStrictRanking("area"),
  };
}

export default async function PriorityFixturePage({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.ESKOMI_QA_SECRET_SENTINEL) throw new Error("secret environment inherited by fixture server");
  const { slug } = await params;
  const fixture = fixtures[slug as keyof typeof fixtures];
  if (!fixture) notFound();
  const area: AreaView = {
    id: fixture.area.id,
    slug: fixture.area.slug,
    name: fixture.area.name,
    parent: 2,
    count: 999,
    description: "QA fixture",
    acf: {},
  };
  const reviewShop = fixture.records.find((record) => record.primaryArea?.id === fixture.area.id);
  const reviewResult: ApprovedGlobalReviewResult = {
    status: "available",
    page: {
      reviews: reviewShop ? [
        {
          id: fixture.area.id * 1000 + 1,
          body: fixture.area.name + "で利用先を探したときの承認済み口コミ本文です。料金や予約方法は公式情報でも確認しました。",
          submittedAt: "2026-08-16T09:00:00+09:00",
          ratings: { total: 5, price: 4, service: 5, cleanliness: 4 },
          shop: { id: reviewShop.id, slug: reviewShop.slug, name: reviewShop.title, primaryArea: reviewShop.primaryArea },
          areas: reviewShop.primaryArea ? [reviewShop.primaryArea] : [],
        },
        {
          id: fixture.area.id * 1000 + 2,
          body: "評価を固定せずに掲載する確認用の承認済み口コミです。",
          submittedAt: "2026-08-15T09:00:00+09:00",
          ratings: { total: null, price: null, service: null, cleanliness: null },
          shop: { id: reviewShop.id, slug: reviewShop.slug, name: reviewShop.title, primaryArea: reviewShop.primaryArea },
          areas: reviewShop.primaryArea ? [reviewShop.primaryArea] : [],
        },
      ] : [],
      total: reviewShop ? 2 : 0,
      totalPages: reviewShop ? 1 : 0,
      page: 1,
    },
  };
  return (
    <AreaHubPageTemplate
      area={area}
      allShops={fixture.records.map((record) => toShop(record, fixture.promotedShopId))}
      rankingEntries={[...fixture.legacyRankingEntries]}
      reviewResult={reviewResult}
    />
  );
}
`;
}

async function createHarness(preview, tempRoot) {
  const trackedFiles = await listTrackedProjectFiles(projectRoot);
  await copyTrackedProjectFiles(projectRoot, tempRoot, trackedFiles);
  await copyTrackedProjectFiles(projectRoot, tempRoot, fixtureSourceFiles);
  await runCommand("cp", ["-cR", path.join(projectRoot, "node_modules"), path.join(tempRoot, "node_modules")], projectRoot);
  const routeDir = path.join(tempRoot, "app", "qa-priority-fixture", "[slug]");
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(path.join(routeDir, "page.tsx"), harnessPageSource(buildFixtureData(preview)));
  await runCommand("npm", ["run", "build"], tempRoot);
}

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
  });
}

async function startServer(root, readinessPath) {
  if (await isPortOpen()) throw new Error(`${baseUrl} is already in use`);
  const args = ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)];
  const child = spawn("npm", args, {
    cwd: root,
    detached: true,
    env: buildMinimalChildEnv(process.env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const remember = (chunk) => {
    if (log.length < 30_000) log = `${log}${chunk}`.slice(0, 30_000);
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited before ready\n${log}`);
    let response;
    try {
      response = await fetch(`${baseUrl}${readinessPath}`, { signal: AbortSignal.timeout(3000) });
    } catch {}
    if (response?.ok) return child;
    if (response && response.status >= 500) {
      const responseBody = await response.text().catch(() => "");
      await new Promise((resolve) => setTimeout(resolve, 250));
      await stopChildProcess(child);
      throw new Error(`server returned ${response.status} during readiness\n${log}\nresponse body:\n${responseBody.slice(0, 8000)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await stopChildProcess(child);
  throw new Error(`server was not ready\n${log}`);
}

async function runFixtureQa(browser) {
  const page = await browser.newPage();
  for (const area of areas) {
    const route = `/qa-priority-fixture/${area.slug}/`;
    const rawResponse = await fetch(`${baseUrl}${route}`);
    const rawHtml = await rawResponse.text();
    check(rawResponse.status === 200, `fixture ${area.slug} raw SSR status`, { status: rawResponse.status });
    check(rawHtml.includes('data-area-precision-mode="true"'), `fixture ${area.slug} raw SSR precision marker`);
    check(rawHtml.includes('data-area-precision-group="exact"'), `fixture ${area.slug} raw SSR exact marker`);
    check(rawHtml.includes('data-area-secondary-shop="true"'), `fixture ${area.slug} raw SSR compact secondary links`);
    check(!rawHtml.includes('aria-label="おすすめランキング'), `fixture ${area.slug} raw SSR rank=0`);
    check(rawHtml.includes(`${area.name}で利用先を探したときの承認済み口コミ本文`), `fixture ${area.slug} raw SSR approved review body`);
    check(rawHtml.includes('href="/reviews/submit/?area=' + area.slug + '"'), `fixture ${area.slug} raw SSR Area review submit link`);
    const rawOrder = [
      rawHtml.indexOf('id="area-decision-guide"'),
      rawHtml.indexOf('id="reviews"'),
      rawHtml.indexOf('id="shop-list"'),
      rawHtml.indexOf('id="faq"'),
      rawHtml.indexOf('id="area-discovery-links"'),
    ];
    check(rawOrder.every((value, index) => value >= 0 && (index === 0 || value > rawOrder[index - 1])), `fixture ${area.slug} raw SSR module order`, { rawOrder });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator('[data-area-precision-mode="true"]').waitFor({ state: "attached", timeout: 60_000 });
      await page.locator("main.hl-route-fallback").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
      scenarios += 1;
      check(response?.status() === 200, `fixture ${area.slug} ${viewport.width}px status`, { status: response?.status() });
      check(await page.locator("h1:visible").count() === 1, `fixture ${area.slug} ${viewport.width}px H1=1`);
      check(await page.locator("h1:visible").innerText() === area.h1, `fixture ${area.slug} ${viewport.width}px unique H1`);
      check(await page.locator('[data-review-card="approved-user"]').count() === 2, `fixture ${area.slug} ${viewport.width}px approved reviews=2`);
      check(await page.locator('[data-area-approved-reviews="true"] a[href="/reviews/"]').count() === 1, `fixture ${area.slug} ${viewport.width}px Reviews Hub link`);
      check(await page.locator(`[data-area-approved-reviews="true"] a[href="/reviews/submit/?area=${area.slug}"]`).count() === 1, `fixture ${area.slug} ${viewport.width}px review submit link`);
      check(await page.locator("#faq .area-hub-faq-accordion__item").count() >= 3, `fixture ${area.slug} ${viewport.width}px Area FAQ rows`);
      check(await page.locator('#area-discovery-links a[href="/"]').count() === 1, `fixture ${area.slug} ${viewport.width}px Top link`);
      check(await page.locator('#area-discovery-links a[href="/reviews/"]').count() === 1, `fixture ${area.slug} ${viewport.width}px Reviews discovery link`);
      for (const nearbySlug of area.nearby) {
        check(await page.locator(`#area-discovery-links a[href="/area/${nearbySlug}/"]`).count() === 1, `fixture ${area.slug} ${viewport.width}px nearby ${nearbySlug} link`);
      }
      const reviewCards = page.locator('[data-review-card="approved-user"]');
      check(
        await reviewCards.nth(0).evaluate((element) => getComputedStyle(element).borderTopStyle === "solid"),
        `fixture ${area.slug} ${viewport.width}px review card neutral border`,
      );
      const firstReviewBox = await reviewCards.nth(0).boundingBox();
      const secondReviewBox = await reviewCards.nth(1).boundingBox();
      check(
        viewport.width <= 760
          ? Math.abs((firstReviewBox?.x ?? 0) - (secondReviewBox?.x ?? 1)) <= 1
          : Math.abs((firstReviewBox?.x ?? 0) - (secondReviewBox?.x ?? 0)) > 1,
        `fixture ${area.slug} ${viewport.width}px review grid columns`,
        { firstReviewBox, secondReviewBox },
      );
      const moduleTops = await page.evaluate(() => ["area-decision-guide", "reviews", "shop-list", "faq", "area-discovery-links"]
        .map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? -1));
      check(moduleTops.every((value, index) => value >= 0 && (index === 0 || value > moduleTops[index - 1])), `fixture ${area.slug} ${viewport.width}px visible module order`, { moduleTops });
      const firstDiscoveryLink = page.locator("#area-discovery-links a").first();
      await firstDiscoveryLink.focus();
      check(await firstDiscoveryLink.evaluate((element) => getComputedStyle(element).outlineStyle !== "none"), `fixture ${area.slug} ${viewport.width}px keyboard focus visible`);
      const exactCards = page.locator('[data-area-precision-group="exact"] [data-area-shop-card="true"]');
      const relatedLinks = page.locator('[data-area-precision-group="related"] [data-area-secondary-shop="true"]');
      const unclassifiedLinks = page.locator('[data-area-precision-group="unclassified"] [data-area-secondary-shop="true"]');
      check(await exactCards.count() === area.exact, `fixture ${area.slug} ${viewport.width}px exact count`, { actual: await exactCards.count() });
      check(await relatedLinks.count() === area.related, `fixture ${area.slug} ${viewport.width}px related count`, { actual: await relatedLinks.count() });
      check(await unclassifiedLinks.count() === area.unclassified, `fixture ${area.slug} ${viewport.width}px unclassified count`, { actual: await unclassifiedLinks.count() });
      check(await page.locator('[data-area-precision-secondary="true"] [data-area-shop-card]').count() === 0, `fixture ${area.slug} ${viewport.width}px secondary full cards=0`);
      const secondaryIds = await page.locator('[data-area-secondary-shop="true"]').evaluateAll((elements) => elements.map((element) => element.getAttribute("data-shop-id")));
      check(secondaryIds.every(Boolean) && new Set(secondaryIds).size === secondaryIds.length, `fixture ${area.slug} ${viewport.width}px secondary identity`);
      const secondaryHrefs = await page.locator('[data-area-secondary-shop="true"] a[href^="/shops/"]').count();
      check(secondaryHrefs === area.related + area.unclassified, `fixture ${area.slug} ${viewport.width}px crawlable secondary links`, { secondaryHrefs });
      const sameNameIds = await page.getByRole("link", { name: "同名でも別IDの店舗", exact: true }).evaluateAll((elements) => elements.map((element) => element.closest('[data-area-secondary-shop="true"]')?.getAttribute("data-shop-id")));
      check(sameNameIds.length === 2 && new Set(sameNameIds).size === 2, `fixture ${area.slug} ${viewport.width}px same-name distinct`);
      check(await page.locator("#ranking").count() === 0, `fixture ${area.slug} ${viewport.width}px ranking module=0`);
      check(await page.locator('[aria-label^="おすすめランキング"]').count() === 0, `fixture ${area.slug} ${viewport.width}px rank badge=0`);
      const stationFixture = area.slug === "umeda";
      check(await page.locator("#compare-tabs").count() === Number(stationFixture), `fixture ${area.slug} ${viewport.width}px capability-aware compare tabs`);
      check(await page.locator("#price-guide").count() === Number(stationFixture), `fixture ${area.slug} ${viewport.width}px capability-aware price module`);
      check(await page.getByRole("button", { name: "初心者向け", exact: true }).count() === 0, `fixture ${area.slug} ${viewport.width}px beginner controls=0`);
      check(await page.getByRole("button", { name: "口コミあり", exact: true }).count() === 0, `fixture ${area.slug} ${viewport.width}px legacy review filter=0`);
      check(await page.getByRole("tab", { name: "駅名・徒歩案内あり", exact: true }).count() === Number(stationFixture), `fixture ${area.slug} ${viewport.width}px station controls`);
      if (stationFixture) {
        check(await page.locator(".ranking-specialty-card--station").count() === 1, `fixture ${area.slug} ${viewport.width}px dedicated station only`);
        check(await page.getByText("梅田駅 徒歩3分", { exact: true }).count() === 1, `fixture ${area.slug} ${viewport.width}px dedicated station walk text`);
        check(await page.locator(".ranking-specialty-card--station").getByText("大阪駅 徒歩1分", { exact: true }).count() === 0, `fixture ${area.slug} ${viewport.width}px generic access excluded`);
        if (viewport.width === 320) {
          await page.locator("details.area-shop-list-mobile-drawer > summary").click();
          const filters = page.locator(".area-filter-chips:visible");
          await filters.getByRole("button", { name: "駅名・徒歩案内あり", exact: true }).click();
          await filters.getByRole("button", { name: "料金掲載あり", exact: true }).click();
          const relaxStation = page.getByRole("button", { name: "駅名・徒歩案内ありを外す（1件）", exact: true });
          const relaxPrice = page.getByRole("button", { name: "料金掲載ありを外す（1件）", exact: true });
          check(await relaxStation.count() === 1 && await relaxPrice.count() === 1, `fixture ${area.slug} ${viewport.width}px relaxation counts`);
          await relaxStation.click();
          check(await page.locator(".area-shop-list-interactive__item:not([hidden])").count() === 1, `fixture ${area.slug} ${viewport.width}px relaxation count equals result`);
          await page.getByRole("button", { name: "絞り込みを解除", exact: true }).click();
        }
      }
      const danglingFragments = await page.locator('a[href^="#"]').evaluateAll((links) => links
        .map((link) => link.getAttribute("href"))
        .filter((href) => href && href.length > 1 && !document.getElementById(href.slice(1))));
      check(danglingFragments.length === 0, `fixture ${area.slug} ${viewport.width}px dangling fragments=0`, { danglingFragments });
      check(await page.locator("nextjs-portal").count() === 0, `fixture ${area.slug} ${viewport.width}px development issue portal=0`);
      const issueText = await page.locator("body").innerText();
      check(!/\b\d+ Issues?\b/u.test(issueText), `fixture ${area.slug} ${viewport.width}px development issue text=0`);
      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
      check(geometry.body <= geometry.viewport + 1, `fixture ${area.slug} ${viewport.width}px overflow=0`, geometry);
      if (viewport.width === 320 || viewport.width === 1440) {
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.hl-fade-in{opacity:1!important;transform:none!important}" });
        const file = path.join(screenshotDir, `fixture-${area.slug}-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true, timeout: 120_000 });
        screenshotFiles.push(file);
        screenshotCount += 1;
      }
    }
  }
  await page.close();
}

async function runLiveFailSafeQa(browser) {
  const page = await browser.newPage();
  for (const area of areas) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto(`${baseUrl}/area/${area.slug}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator('[data-area-precision-mode="true"]').waitFor({ state: "attached", timeout: 60_000 });
      await page.locator("main.hl-route-fallback").waitFor({ state: "detached", timeout: 60_000 });
      scenarios += 1;
      check(response?.status() === 200, `live ${area.slug} ${viewport.width}px crash=0`, { status: response?.status() });
      check(await page.locator("h1:visible").count() === 1, `live ${area.slug} ${viewport.width}px H1=1`);
      check(await page.locator("h1:visible").innerText() === area.h1, `live ${area.slug} ${viewport.width}px unique H1`);
      const exactCount = await page.locator('[data-area-precision-group="exact"] [data-area-shop-card]').count();
      check(exactCount === 0, `live ${area.slug} ${viewport.width}px false EXACT=0`, { exactCount });
      check(await page.locator("#ranking").count() === 0, `live ${area.slug} ${viewport.width}px ranking=0`);
      check(await page.locator('[aria-label^="おすすめランキング"]').count() === 0, `live ${area.slug} ${viewport.width}px rank badge=0`);
      check(await page.locator("#compare-tabs").count() === 0, `live ${area.slug} ${viewport.width}px empty compare tabs=0`);
      check(await page.locator("#price-guide").count() === 0, `live ${area.slug} ${viewport.width}px empty price module=0`);
      check(await page.locator('#area-discovery-links a[href="/"]').count() === 1, `live ${area.slug} ${viewport.width}px Top link`);
      check(await page.locator('#area-discovery-links a[href="/reviews/"]').count() === 1, `live ${area.slug} ${viewport.width}px Reviews link`);
      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
      check(geometry.body <= geometry.viewport + 1, `live ${area.slug} ${viewport.width}px overflow=0`, geometry);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      check(canonical === `https://mens-esthe-kuchikomi.com/area/${area.slug}/`, `live ${area.slug} ${viewport.width}px canonical unchanged`, { canonical });
      if (viewport.width === 320 || viewport.width === 1440) {
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.hl-fade-in{opacity:1!important;transform:none!important}" });
        const file = path.join(screenshotDir, `live-${area.slug}-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true, timeout: 120_000 });
        screenshotFiles.push(file);
        screenshotCount += 1;
      }
    }
  }
  await page.close();
}

await fs.rm(reportDir, { recursive: true, force: true });
await fs.mkdir(screenshotDir, { recursive: true });
const preview = JSON.parse(await fs.readFile(path.join(repositoryRoot, "docs", "data-clean", "priority5", "primary-area-backfill-preview-2026-08-16.json"), "utf8"));
let browser;
let server;
let harnessRoot;
let tempParent;
let ownsTempParent = false;
try {
  if (process.env.BROWSER_QA_TEMP_PARENT) {
    tempParent = path.resolve(process.env.BROWSER_QA_TEMP_PARENT);
    await fs.mkdir(tempParent, { recursive: true });
  } else {
    tempParent = await fs.mkdtemp(path.join(os.tmpdir(), "eskomi-t3a-browser-parent-"));
    ownsTempParent = true;
  }
  harnessRoot = await fs.mkdtemp(path.join(tempParent, "harness-"));
  await createHarness(preview, harnessRoot);
  browser = await chromium.launch({ headless });
  server = await startServer(harnessRoot, "/qa-priority-fixture/umeda/");
  if (process.env.BROWSER_QA_INJECT_FAILURE === "after-server") {
    throw new Error("injected failure after server");
  }
  await runFixtureQa(browser);
  await stopChildProcess(server);
  server = undefined;
  if (!fixtureOnly) {
    await fs.access(path.join(projectRoot, ".next", "BUILD_ID"));
    server = await startServer(projectRoot, "/area/umeda/");
    await runLiveFailSafeQa(browser);
  }
} catch (error) {
  failures.push({ label: "browser runner completed", details: { message: String(error?.stack || error) } });
} finally {
  const cleanupResults = await Promise.allSettled([
    browser?.close(),
    cleanupHarnessResources({
      children: [server],
      roots: [harnessRoot, ownsTempParent ? tempParent : undefined],
    }),
  ]);
  for (const result of cleanupResults) {
    if (result.status === "rejected") {
      failures.push({ label: "browser harness cleanup", details: { message: String(result.reason?.stack || result.reason) } });
    }
  }
}

const summary = {
  harness: "temporary production Next app from tracked files importing actual AreaHubPageTemplate and production CSS",
  modes: { fixture: 55, liveFailSafe: fixtureOnly ? 0 : 55 },
  scenarios,
  assertions,
  screenshots: screenshotCount,
  screenshotFiles,
  failures,
};
await fs.writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
