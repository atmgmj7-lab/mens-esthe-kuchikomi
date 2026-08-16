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
  stopChildProcess,
} from "./lib/priority-area-browser-harness.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(projectRoot, "reports", "ux-prod-t4-shop-detail");
const screenshotDir = path.join(reportDir, "screenshots");
const port = 3114;
const baseUrl = `http://127.0.0.1:${port}`;
const representativeShopReviewsPath = "/shops/milk-tea%ef%bc%88%e3%83%9f%e3%83%ab%e3%82%af%e3%83%86%e3%82%a3%e3%83%bc%ef%bc%89/reviews/";
const headless = process.env.T4_BROWSER_HEADLESS === "1";
const fixtureSourceFiles = [
  "components/shop-detail/ShopRelatedLinks.tsx",
  "lib/shop-detail-area.ts",
];
const viewports = [320, 375, 390, 760, 761, 900, 901, 1024, 1025, 1280, 1440]
  .map((width) => ({ width, height: width <= 390 ? 844 : width >= 1280 ? 1000 : 900 }));
const variants = [
  {
    slug: "rich",
    title: "梅田のとても長い日本語店舗名でも安全に折り返して読める確認用メンズエステ店舗",
    primaryArea: { id: 4, slug: "umeda", name: "梅田" },
    reviewCount: 4,
    graph: true,
    price: true,
    fallback: false,
  },
  {
    slug: "sparse",
    title: "Primary Area未設定の確認用店舗",
    primaryArea: null,
    reviewCount: 2,
    graph: false,
    price: false,
    fallback: true,
  },
  {
    slug: "price-only",
    title: "大阪日本橋の料金掲載確認用店舗",
    primaryArea: { id: 7, slug: "nihonbashi", name: "大阪日本橋" },
    reviewCount: 0,
    graph: false,
    price: true,
    fallback: true,
  },
];

let scenarios = 0;
let assertions = 0;
let screenshots = 0;
const screenshotFiles = [];
const failures = [];

function check(condition, label, details = {}) {
  assertions += 1;
  if (!condition) failures.push({ label, details });
}

async function runCommand(command, args, cwd, timeoutMs = 240_000) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env: buildMinimalChildEnv(process.env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const remember = (chunk) => { output = `${output}${chunk}`.slice(-40_000); };
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

function fixturePageSource() {
  return `import { notFound } from "next/navigation";
import { ShopDetail } from "@/components/ShopDetail";
import { normalizeShopRanking } from "@/lib/shop-ranking";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import type { ApprovedShopReviewResult, AreaView, ShopView } from "@/lib/wp/types";

const fixtures = ${JSON.stringify(variants)} as const;
export const instant = false;
type Fixture = (typeof fixtures)[number];

function areaFor(fixture: Fixture): AreaView | null {
  if (!fixture.primaryArea) return null;
  return {
    ...fixture.primaryArea,
    parent: 2,
    count: 1,
    description: "QA fixture",
    acf: {},
  };
}

function reviewsFor(fixture: Fixture): ApprovedShopReviewResult {
  const reviews = Array.from({ length: fixture.reviewCount }, (_, index) => ({
    id: 7000 + index,
    body: \`承認済みユーザー口コミ\${index + 1}。料金や接客の体験を具体的に確認するための本文です。\`,
    submittedAt: \`2026-08-\${String(16 - index).padStart(2, "0")}T09:00:00+09:00\`,
    ratings: {
      total: index < (fixture.graph ? 4 : 2) ? (index % 2 === 0 ? 5 : 4) : null,
      price: index < (fixture.graph ? 4 : 2) ? 4 : null,
      service: index < (fixture.graph ? 4 : 2) ? 5 : null,
      cleanliness: index < (fixture.graph ? 4 : 2) ? 4 : null,
    },
  }));
  const responseCount = fixture.reviewCount;
  const average = responseCount > 0 ? 4.5 : null;
  return {
    status: "available",
    page: {
      reviews,
      total: fixture.reviewCount,
      totalPages: fixture.reviewCount > 0 ? 1 : 0,
      page: 1,
      metrics: {
        total: { average, responseCount },
        price: { average: responseCount > 0 ? 4 : null, responseCount },
        service: { average: responseCount > 0 ? 5 : null, responseCount },
        cleanliness: { average: responseCount > 0 ? 4 : null, responseCount },
      },
      dateRange: fixture.reviewCount > 0
        ? { oldestSubmittedAt: reviews.at(-1)?.submittedAt ?? "", latestSubmittedAt: reviews[0]?.submittedAt ?? "" }
        : null,
    },
  };
}

function shopFor(fixture: Fixture): ShopView {
  const areaTerms = fixture.primaryArea
    ? [{ ...fixture.primaryArea, parent: 2, count: 1, taxonomy: "area" }]
    : [{ id: 999, slug: "taxonomy-order-must-not-be-primary", name: "推測禁止地域", parent: 2, count: 1, taxonomy: "area" }];
  const acf: Record<string, unknown> = {
    shop_hours: "11:00〜翌2:00",
    shop_address: fixture.slug === "sparse" ? "" : "大阪府大阪市の公開確認用住所",
    shop_station: fixture.slug === "sparse" ? "" : fixture.primaryArea?.name + "駅",
    shop_access: fixture.slug === "sparse" ? "" : "駅から案内に沿って徒歩5分",
    shop_booking_url: fixture.slug === "rich" ? "https://booking.example.test/rich" : "",
    shop_features: fixture.slug === "rich" ? ["個室", "駅から徒歩圏内"] : [],
    shop_catch: fixture.slug === "rich" ? "確認済みの店舗公開情報を整理しています。" : "",
    shop_ai_summary: fixture.slug === "rich" ? "編集部コメントは承認済み口コミとは分けて表示します。" : "",
    shop_updated_at: "2026-08-17",
    ...(fixture.price ? { price_90: "14,000円", price_120: "18,000円" } : {}),
  };
  return {
    id: fixture.slug === "rich" ? 8101 : fixture.slug === "sparse" ? 8102 : 8103,
    slug: \`qa-\${fixture.slug}\`,
    link: \`https://mens-esthe-kuchikomi.com/shops/qa-\${fixture.slug}/\`,
    title: fixture.title,
    contentHtml: fixture.slug === "rich" ? "<p>店舗が公開している紹介情報を確認用に表示します。</p>" : "",
    excerpt: "",
    imageUrl: "",
    media: {
      cardSquare: fixture.fallback
        ? { mediaId: null, source: "fallback", url: "", alt: fixture.title }
        : { mediaId: 9001, source: "legacy-featured", url: "/images/eskomi-logo.svg", alt: fixture.title, width: 960, height: 960 },
      detailBanner: null,
    },
    terms: areaTerms,
    acf,
    officialUrl: fixture.slug === "rich" ? "https://official.example.test/rich" : "",
    areaSlug: fixture.primaryArea?.slug ?? "taxonomy-order-must-not-be-primary",
    primaryArea: fixture.primaryArea,
    ranking: normalizeShopRanking({}),
    strictRanking: unavailableStrictRanking("shop"),
  };
}

export default async function ShopDetailFixturePage({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.ESKOMI_QA_SECRET_SENTINEL) throw new Error("secret environment inherited by fixture server");
  const { slug } = await params;
  const fixture = fixtures.find((entry) => entry.slug === slug);
  if (!fixture) notFound();
  return <ShopDetail shop={shopFor(fixture)} parentArea={areaFor(fixture)} reviewResult={reviewsFor(fixture)} />;
}
`;
}

async function createHarness(tempRoot) {
  const trackedFiles = await listTrackedProjectFiles(projectRoot);
  await copyTrackedProjectFiles(projectRoot, tempRoot, trackedFiles);
  await copyTrackedProjectFiles(projectRoot, tempRoot, fixtureSourceFiles);
  await runCommand("cp", ["-cR", path.join(projectRoot, "node_modules"), path.join(tempRoot, "node_modules")], projectRoot);
  const routeDir = path.join(tempRoot, "app", "qa-shop-detail", "[slug]");
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(path.join(routeDir, "page.tsx"), fixturePageSource());
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

async function startServer(root) {
  if (await isPortOpen()) throw new Error(`${baseUrl} is already in use`);
  const child = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    detached: true,
    env: buildMinimalChildEnv(process.env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const remember = (chunk) => { log = `${log}${chunk}`.slice(-30_000); };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/qa-shop-detail/rich/`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return child;
      if (response.status >= 500) throw new Error(`server readiness returned ${response.status}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("server readiness")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await stopChildProcess(child);
  throw new Error(`server was not ready\n${log}`);
}

function jsonLdByType(entries, type) {
  return entries.find((entry) => entry && typeof entry === "object" && entry["@type"] === type);
}

async function runFixtureQa(browser) {
  const page = await browser.newPage();
  for (const variant of variants) {
    const route = `/qa-shop-detail/${variant.slug}/`;
    const rawResponse = await fetch(`${baseUrl}${route}`);
    const rawHtml = await rawResponse.text();
    check(rawResponse.status === 200, `${variant.slug} SSR status`, { status: rawResponse.status });
    check(rawHtml.includes('data-shop-detail-root="true"') || rawHtml.includes("data-shop-detail-root"), `${variant.slug} SSR root`);
    check(rawHtml.includes('data-detail-banner="absent"'), `${variant.slug} SSR banner absent`);
    check(rawHtml.includes("口コミ・体験"), `${variant.slug} SSR review section`);
    check(rawHtml.includes("承認済みユーザー口コミ"), `${variant.slug} SSR approved provenance copy`);
    if (variant.reviewCount > 0) {
      check(rawHtml.includes("承認済みユーザー口コミ1"), `${variant.slug} SSR approved review body`);
    }
    if (variant.primaryArea) {
      check(rawHtml.includes(`href="/area/${variant.primaryArea.slug}/"`), `${variant.slug} SSR explicit Primary Area link`);
    } else {
      check(!rawHtml.includes('href="/area/taxonomy-order-must-not-be-primary/"'), `${variant.slug} SSR taxonomy order not inferred`);
    }

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator("[data-shop-detail-root]").waitFor({ state: "attached", timeout: 60_000 });
      scenarios += 1;
      check(response?.status() === 200, `${variant.slug} ${viewport.width}px status`, { status: response?.status() });
      check(await page.locator("main h1:visible").count() === 1, `${variant.slug} ${viewport.width}px H1=1`);
      check(await page.locator("main h1:visible").innerText() === variant.title, `${variant.slug} ${viewport.width}px exact H1`);
      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
      check(geometry.body <= geometry.viewport + 1, `${variant.slug} ${viewport.width}px overflow=0`, geometry);

      const imageBox = await page.locator('[data-shop-card-square="true"] img').boundingBox();
      check(Boolean(imageBox) && Math.abs((imageBox?.width ?? 0) - (imageBox?.height ?? 1)) <= 2, `${variant.slug} ${viewport.width}px square image`, imageBox ?? {});
      check(await page.locator('[data-detail-banner="absent"]').count() === 1, `${variant.slug} ${viewport.width}px detail banner absent`);
      check(await page.getByText(`承認済み口コミ ${variant.reviewCount}件`, { exact: false }).count() >= 1, `${variant.slug} ${viewport.width}px approved count`);
      check(await page.locator('[aria-label="承認済み口コミの評価グラフ"]').count() === Number(variant.graph), `${variant.slug} ${viewport.width}px graph threshold`);
      check(await page.locator("#reviews article").count() === Math.min(3, variant.reviewCount), `${variant.slug} ${viewport.width}px latest approved review cards`);
      check(await page.locator("#prices").count() === Number(variant.price), `${variant.slug} ${viewport.width}px confirmed price visibility`);
      check(await page.locator("#ranking, #coupon, #therapist, #schedule").count() === 0, `${variant.slug} ${viewport.width}px unsupported modules absent`);

      const sectionIds = await page.locator("[data-shop-detail-root] section[id]").evaluateAll((sections) => sections.map((section) => section.id));
      check(sectionIds[0] === "reviews", `${variant.slug} ${viewport.width}px reviews first after Shop Top`, { sectionIds });
      if (variant.price) check(sectionIds[1] === "prices", `${variant.slug} ${viewport.width}px price follows reviews`, { sectionIds });
      const navTargets = await page.locator('nav[aria-label="店舗詳細のページ内メニュー"] a[href^="#"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      const missingTargets = await page.evaluate((targets) => targets.filter((href) => href && !document.getElementById(href.slice(1))), navTargets);
      check(navTargets.length >= 2, `${variant.slug} ${viewport.width}px section nav destinations`, { navTargets });
      check(missingTargets.length === 0, `${variant.slug} ${viewport.width}px section nav targets`, { missingTargets });

      const submitLinks = page.locator(`a[href^="/reviews/submit"][href*="shop=qa-${variant.slug}"]`);
      const submitLinkCount = await submitLinks.count();
      check(submitLinkCount === 2, `${variant.slug} ${viewport.width}px review and related submit CTAs`, { submitLinkCount });
      check(await page.locator(`#reviews a[href^="/reviews/submit"][href*="shop=qa-${variant.slug}"]`).count() === 1, `${variant.slug} ${viewport.width}px review section submit CTA`);
      check(await page.locator(`#nearby a[href^="/reviews/submit"][href*="shop=qa-${variant.slug}"]`).count() === 1, `${variant.slug} ${viewport.width}px related section submit CTA`);
      if (submitLinkCount > 0) {
        const submitLink = submitLinks.first();
        const submitBox = await submitLink.boundingBox();
        check(Boolean(submitBox) && (submitBox?.height ?? 0) >= 44, `${variant.slug} ${viewport.width}px review CTA target >=44`, submitBox ?? {});
        await submitLink.focus();
        check(await submitLink.evaluate((element) => getComputedStyle(element).outlineStyle !== "none"), `${variant.slug} ${viewport.width}px keyboard focus visible`);
      }

      if (variant.primaryArea) {
        check(await page.locator(`#nearby a[href="/area/${variant.primaryArea.slug}/"]`).count() === 1, `${variant.slug} ${viewport.width}px explicit area related link`);
      } else {
        check(await page.locator('#nearby a[href^="/area/"]').count() === 0, `${variant.slug} ${viewport.width}px no inferred area link`);
      }
      check(await page.locator(`#nearby a[href="/shops/qa-${variant.slug}/reviews/"]`).count() === 1, `${variant.slug} ${viewport.width}px Shop reviews link`);
      check(await page.locator('#nearby a[href="/reviews/"]').count() === 1, `${variant.slug} ${viewport.width}px Reviews Hub link`);

      const schemaEntries = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.flatMap((script) => {
        try { return [JSON.parse(script.textContent || "null")]; } catch { return []; }
      }));
      const localBusiness = jsonLdByType(schemaEntries, "HealthAndBeautyBusiness");
      const breadcrumb = jsonLdByType(schemaEntries, "BreadcrumbList");
      check(Boolean(localBusiness), `${variant.slug} ${viewport.width}px LocalBusiness subtype schema`);
      check(Boolean(breadcrumb), `${variant.slug} ${viewport.width}px Breadcrumb schema`);
      check(Boolean(localBusiness?.aggregateRating) === variant.graph, `${variant.slug} ${viewport.width}px AggregateRating threshold`);
      check(localBusiness?.review === undefined, `${variant.slug} ${viewport.width}px author-less Review schema absent`);
      if (variant.graph) {
        check(localBusiness?.aggregateRating?.ratingCount === variant.reviewCount, `${variant.slug} ${viewport.width}px valid ratingCount`);
        check(localBusiness?.aggregateRating?.reviewCount === variant.reviewCount, `${variant.slug} ${viewport.width}px approved reviewCount`);
      }
      check(Boolean(localBusiness?.areaServed) === Boolean(variant.primaryArea), `${variant.slug} ${viewport.width}px schema Primary Area only`);

      const titleGeometry = await page.locator("main h1").evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
      check(titleGeometry.scrollWidth <= titleGeometry.clientWidth + 1, `${variant.slug} ${viewport.width}px long title wraps`, titleGeometry);
      check(await page.locator("header.escomi-final-site-header").count() === 1, `${variant.slug} ${viewport.width}px site header`);
      check(await page.locator("footer").count() >= 1, `${variant.slug} ${viewport.width}px footer`);

      const takeScreenshot = (variant.slug === "rich" && [320, 390, 1024, 1440].includes(viewport.width))
        || (variant.slug === "sparse" && [375, 1280].includes(viewport.width))
        || (variant.slug === "price-only" && [760, 1025].includes(viewport.width));
      if (takeScreenshot) {
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.hl-fade-in{opacity:1!important;transform:none!important}" });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const file = path.join(screenshotDir, `${variant.slug}-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true, timeout: 120_000 });
        screenshotFiles.push(file);
        screenshots += 1;
      }
    }
  }
  await page.close();
}

async function runCrossRouteSmoke(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const route of ["/", "/reviews/", "/area/umeda/", "/qa-shop-detail/rich/", representativeShopReviewsPath, "/reviews/submit/"]) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("main").first().waitFor({ state: "attached", timeout: 60_000 });
    await page.locator("h1:visible").first().waitFor({ state: "visible", timeout: 60_000 });
    check(Boolean(response) && (response?.status() ?? 500) < 400, `cross-route ${route} status`, { status: response?.status() });
    check(await page.locator("h1:visible").count() === 1, `cross-route ${route} H1=1`);
    const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
    check(geometry.body <= geometry.viewport + 1, `cross-route ${route} overflow=0`, geometry);
  }
  await page.close();
}

await fs.mkdir(screenshotDir, { recursive: true });
let browser;
let server;
let tempParent;
let harnessRoot;
try {
  tempParent = await fs.mkdtemp(path.join(os.tmpdir(), "eskomi-t4-browser-parent-"));
  harnessRoot = await fs.mkdtemp(path.join(tempParent, "harness-"));
  await createHarness(harnessRoot);
  server = await startServer(harnessRoot);
  browser = await chromium.launch({ headless });
  await runFixtureQa(browser);
  await runCrossRouteSmoke(browser);
} catch (error) {
  failures.push({ label: "browser runner completed", details: { message: String(error?.stack || error) } });
} finally {
  const cleanupResults = await Promise.allSettled([
    browser?.close(),
    cleanupHarnessResources({ children: [server], roots: [harnessRoot, tempParent] }),
  ]);
  for (const result of cleanupResults) {
    if (result.status === "rejected") {
      failures.push({ label: "browser harness cleanup", details: { message: String(result.reason?.stack || result.reason) } });
    }
  }
}

const summary = {
  harness: "temporary production Next app from tracked files importing actual ShopDetail and production CSS",
  browser: headless ? "Chromium headless (explicit opt-in)" : "Chromium headed",
  variants: variants.map(({ slug }) => slug),
  viewports: viewports.map(({ width }) => width),
  scenarios,
  assertions,
  screenshots,
  screenshotFiles,
  crossRouteSmoke: 6,
  failures,
};
await fs.writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
