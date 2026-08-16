import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(projectRoot, "..");
const reportDir = path.join(projectRoot, "reports", "ux-prod-t3a-primary-aware");
const screenshotDir = path.join(reportDir, "screenshots");
const port = 3113;
const baseUrl = `http://127.0.0.1:${port}`;
const fixtureOnly = process.env.BROWSER_QA_FIXTURE_ONLY === "1";
const headless = process.env.BROWSER_QA_HEADLESS === "1";
const viewports = [320, 375, 390, 760, 761, 900, 901, 1024, 1025, 1280, 1440]
  .map((width) => ({ width, height: width <= 390 ? 844 : width >= 1280 ? 1000 : 900 }));
const areas = [
  { id: 17, slug: "sakai", name: "堺東", exact: 6, related: 1, unclassified: 1 },
  { id: 13, slug: "shinosaka", name: "新大阪", exact: 3, related: 1, unclassified: 1 },
  { id: 7, slug: "nihonbashi", name: "大阪日本橋", exact: 12, related: 1, unclassified: 1 },
  { id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", exact: 18, related: 2, unclassified: 1 },
  { id: 4, slug: "umeda", name: "梅田", exact: 5, related: 2, unclassified: 1 },
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
    return [area.slug, {
      area,
      records: [...accepted, related, unclassified],
      legacyRankingEntries: exactRecords.map((record, index) => ({ shopSlug: record.slug, rank: index + 1 })),
      promotedShopId: exactRecords[0]?.id ?? null,
    }];
  }));
}

function cloneDirectory(source, destination) {
  return new Promise((resolve, reject) => {
    const child = spawn("cp", ["-cR", source, destination], { stdio: ["ignore", "pipe", "pipe"] });
    let errorOutput = "";
    child.stderr.on("data", (chunk) => { errorOutput += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`copy-on-write node_modules clone failed (${code})\n${errorOutput}`));
    });
  });
}

function harnessPageSource(fixtureData) {
  return `import { notFound } from "next/navigation";
import { AreaHubPageTemplate } from "@/components/area/AreaHubPageTemplate";
import { normalizeShopRanking } from "@/lib/shop-ranking";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import type { AreaView, ShopView, WpTerm } from "@/lib/wp/types";

const fixtures = ${JSON.stringify(fixtureData)} as const;

function toTerm(record: { id: number; slug: string; name: string }): WpTerm {
  return { ...record, count: 1, parent: 2, taxonomy: "area" };
}

function toShop(record: (typeof fixtures)[keyof typeof fixtures]["records"][number], promotedShopId: number | null): ShopView {
  const acf: Record<string, unknown> = {
    ranking_enabled: true,
    area_rank: 1,
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
  return (
    <AreaHubPageTemplate
      area={area}
      allShops={fixture.records.map((record) => toShop(record, fixture.promotedShopId))}
      rankingEntries={[...fixture.legacyRankingEntries]}
    />
  );
}
`;
}

async function createHarness(preview) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "eskomi-t3a-browser-"));
  await fs.cp(projectRoot, tempRoot, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(projectRoot, source);
      if (!relative) return true;
      const first = relative.split(path.sep)[0];
      if ([".next", "node_modules", "reports"].includes(first)) return false;
      return !path.basename(source).startsWith(".env");
    },
  });
  await cloneDirectory(path.join(projectRoot, "node_modules"), path.join(tempRoot, "node_modules"));
  const routeDir = path.join(tempRoot, "app", "qa-priority-fixture", "[slug]");
  await fs.mkdir(routeDir, { recursive: true });
  await fs.writeFile(path.join(routeDir, "page.tsx"), harnessPageSource(buildFixtureData(preview)));
  return tempRoot;
}

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) {
    try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  }
}

async function startServer(root, mode) {
  if (await isPortOpen()) throw new Error(`${baseUrl} is already in use`);
  const args = mode === "dev"
    ? ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)]
    : ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)];
  const child = spawn("npm", args, { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  const remember = (chunk) => {
    if (log.length < 30_000) log = `${log}${chunk}`.slice(0, 30_000);
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  const readinessPath = mode === "dev" ? "/qa-priority-fixture/umeda/" : "/area/umeda/";
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
      await stopServer(child);
      throw new Error(`server returned ${response.status} during readiness\n${log}\nresponse body:\n${responseBody.slice(0, 8000)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await stopServer(child);
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

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator('[data-area-precision-mode="true"]').waitFor({ state: "attached", timeout: 60_000 });
      await page.locator("main.hl-route-fallback").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
      scenarios += 1;
      check(response?.status() === 200, `fixture ${area.slug} ${viewport.width}px status`, { status: response?.status() });
      check(await page.locator("h1:visible").count() === 1, `fixture ${area.slug} ${viewport.width}px H1=1`);
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
      check(await page.locator("#compare-tabs").count() === 0, `fixture ${area.slug} ${viewport.width}px empty compare tabs=0`);
      check(await page.locator("#price-guide").count() === 0, `fixture ${area.slug} ${viewport.width}px empty price module=0`);
      check(await page.getByRole("button", { name: "初心者向け", exact: true }).count() === 0, `fixture ${area.slug} ${viewport.width}px beginner controls=0`);
      check(await page.getByRole("button", { name: "駅名・徒歩案内あり", exact: true }).count() === 0, `fixture ${area.slug} ${viewport.width}px station controls=0`);
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
      const exactCount = await page.locator('[data-area-precision-group="exact"] [data-area-shop-card]').count();
      check(exactCount === 0, `live ${area.slug} ${viewport.width}px false EXACT=0`, { exactCount });
      check(await page.locator("#ranking").count() === 0, `live ${area.slug} ${viewport.width}px ranking=0`);
      check(await page.locator('[aria-label^="おすすめランキング"]').count() === 0, `live ${area.slug} ${viewport.width}px rank badge=0`);
      check(await page.locator("#compare-tabs").count() === 0, `live ${area.slug} ${viewport.width}px empty compare tabs=0`);
      check(await page.locator("#price-guide").count() === 0, `live ${area.slug} ${viewport.width}px empty price module=0`);
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
try {
  browser = await chromium.launch({ headless });
  harnessRoot = await createHarness(preview);
  server = await startServer(harnessRoot, "dev");
  await runFixtureQa(browser);
  await stopServer(server);
  server = undefined;
  if (!fixtureOnly) {
    await fs.access(path.join(projectRoot, ".next", "BUILD_ID"));
    server = await startServer(projectRoot, "start");
    await runLiveFailSafeQa(browser);
  }
} catch (error) {
  failures.push({ label: "browser runner completed", details: { message: String(error?.stack || error) } });
} finally {
  await browser?.close();
  await stopServer(server);
  if (harnessRoot) await fs.rm(harnessRoot, { recursive: true, force: true });
}

const summary = {
  harness: "temporary Next app importing actual AreaHubPageTemplate and production CSS",
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
