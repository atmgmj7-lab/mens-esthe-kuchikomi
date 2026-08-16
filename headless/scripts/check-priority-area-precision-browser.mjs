import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import ts from "typescript";
import vm from "node:vm";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(projectRoot, "..");
const reportDir = path.join(projectRoot, "reports", "ux-prod-t3a-primary-aware");
const screenshotDir = path.join(reportDir, "screenshots");
const port = 3113;
const baseUrl = `http://127.0.0.1:${port}`;
const viewports = [320, 375, 390, 760, 761, 900, 901, 1024, 1025, 1280, 1440]
  .map((width) => ({ width, height: width <= 390 ? 844 : width >= 1280 ? 1000 : 900 }));
const areas = [
  { id: 17, slug: "sakai", name: "堺東", expected: 6 },
  { id: 13, slug: "shinosaka", name: "新大阪", expected: 3 },
  { id: 7, slug: "nihonbashi", name: "大阪日本橋", expected: 12 },
  { id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", expected: 18 },
  { id: 4, slug: "umeda", name: "梅田", expected: 5 },
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

async function loadClassifier() {
  const file = path.join(projectRoot, "lib", "priority-area-precision.ts");
  const source = await fs.readFile(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  const require = (id) => {
    if (id === "@/lib/area-shop-utils") {
      return { isBeginnerFriendlyShop: () => false, isStationNearShop: () => false };
    }
    throw new Error(`Unexpected fixture import: ${id}`);
  };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require });
  return loaded.exports;
}

async function verifyProductionTemplateContract() {
  const source = await fs.readFile(path.join(projectRoot, "components", "area", "AreaHubPageTemplate.tsx"), "utf8");
  const contracts = [
    [source.includes("classifyPriorityAreaShops(allShops, area)"), "production template uses the tested classifier"],
    [source.includes("const mainShops: ShopView[] = precisionGroups ? [...precisionGroups.exact] : allShops"), "production primary list is EXACT only"],
    [source.includes("shopItemListJsonLd(mainShops.filter"), "production schema uses EXACT only"],
    [source.includes("rankingShops={mainShops}"), "production ranking uses EXACT only"],
    [source.includes("<AreaPromotionSection shops={mainShops}"), "production promotion uses EXACT only"],
    [source.includes('data-area-precision-group={precisionMode ? "exact" : undefined}'), "production SSR exposes the EXACT marker"],
    [source.includes('data-area-precision-group="related"'), "production SSR exposes the related marker"],
    [source.includes('data-area-precision-group="unclassified"'), "production SSR exposes the unclassified marker"],
    [source.includes("rank={null} showRank={false}"), "production secondary groups cannot display a rank"],
  ];
  for (const [condition, label] of contracts) check(condition, label);
}

function fixtureShop(record) {
  return {
    id: record.wpShopId,
    slug: record.shopSlug,
    title: record.shopName,
    acf: {},
    primaryArea: {
      id: record.targetPrimaryArea.termId,
      slug: record.targetPrimaryArea.slug,
      name: record.targetPrimaryArea.label,
    },
    terms: record.currentAreaRelations.map((relation) => ({
      id: relation.termId,
      slug: relation.slug,
      name: relation.label,
      taxonomy: "area",
    })),
  };
}

function fixtureHtml(area, groups) {
  const cards = (shops, relation) => shops.map((shop) => (
    `<article data-area-shop-card="true" data-relation="${relation}" data-shop-id="${shop.id}"><h3>${shop.title}</h3><a href="/shops/${shop.slug}/">店舗詳細</a></article>`
  )).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#fbfaf6;color:#17353a;font-family:Arial,sans-serif}.page{width:min(1120px,calc(100% - 32px));margin:auto;padding:32px 0}.group{margin-top:24px}.cards{display:grid;grid-template-columns:1fr;gap:12px}article{min-width:0;padding:16px;border:1px solid #d8dedc;background:white}h1,h2,h3{overflow-wrap:anywhere}a{display:inline-flex;min-height:44px;align-items:center;color:#006f72}@media(min-width:901px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
  </style></head><body><main class="page" data-area-precision-fixture="${area.slug}"><h1>${area.name}メンズエステ</h1><section class="group" data-area-precision-group="exact"><h2>このエリアの店舗</h2><div class="cards">${cards(groups.exact, "exact")}</div></section><section class="group" data-area-precision-group="related"><h2>関連店舗</h2><div class="cards">${cards(groups.related, "related")}</div></section><section class="group" data-area-precision-group="unclassified"><h2>主な掲載エリアを確認中の店舗</h2><div class="cards">${cards(groups.unclassified, "unclassified")}</div></section></main></body></html>`;
}

async function runFixtureQa(browser, classifier, preview) {
  const page = await browser.newPage();
  for (const area of areas) {
    const exactFixture = preview.records.map(fixtureShop);
    const sameName = "同名でも別IDの店舗";
    const related = {
      id: 900000 + area.id,
      slug: `related-${area.slug}`,
      title: sameName,
      acf: { shop_access: `${area.name}駅 徒歩1分` },
      primaryArea: { id: 999, slug: "other", name: "別エリア" },
      terms: [{ id: area.id, slug: area.slug, name: area.name, taxonomy: "area" }],
    };
    const unclassified = {
      ...related,
      id: 910000 + area.id,
      slug: `unclassified-${area.slug}`,
      primaryArea: null,
    };
    const groups = classifier.classifyPriorityAreaShops([...exactFixture, related, unclassified], area);
    const html = fixtureHtml(area, groups);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.setContent(html, { waitUntil: "load" });
      scenarios += 1;
      const exactCards = page.locator('[data-area-precision-group="exact"] [data-area-shop-card]');
      const allCards = page.locator("[data-area-shop-card]");
      check(await exactCards.count() === area.expected, `fixture ${area.slug} ${viewport.width}px exact count`);
      check(await page.locator(`[data-area-precision-group="related"] [data-shop-id="${related.id}"]`).count() === 1, `fixture ${area.slug} ${viewport.width}px related separation`);
      check(await page.locator('[data-area-precision-group="unclassified"] [data-area-shop-card]').count() === 1, `fixture ${area.slug} ${viewport.width}px unclassified separation`);
      check(await page.locator("h1").count() === 1, `fixture ${area.slug} ${viewport.width}px H1=1`);
      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
      check(geometry.body <= geometry.viewport + 1, `fixture ${area.slug} ${viewport.width}px overflow=0`, geometry);
      const ids = await allCards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-shop-id")));
      check(new Set(ids).size === ids.length, `fixture ${area.slug} ${viewport.width}px duplicate ID=0`);
      const sameNameIds = await page.getByRole("heading", { name: sameName, exact: true }).evaluateAll((elements) => elements.map((element) => element.closest("article")?.getAttribute("data-shop-id")));
      check(sameNameIds.length === 2 && new Set(sameNameIds).size === 2, `fixture ${area.slug} ${viewport.width}px same-name distinct`);
      check(await page.locator('[data-module="beginner"]').count() === 0, `fixture ${area.slug} ${viewport.width}px empty beginner=0`);
      check(await page.locator('[data-module="station"]').count() === 0, `fixture ${area.slug} ${viewport.width}px contradictory station=0`);
      check(await page.locator('[data-rank]').count() === 0, `fixture ${area.slug} ${viewport.width}px fake rank=0`);
      if (viewport.width === 320 || viewport.width === 1440) {
        const file = path.join(screenshotDir, `fixture-${area.slug}-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        screenshotFiles.push(file);
        screenshotCount += 1;
      }
    }
  }
  await page.close();
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

async function startServer() {
  if (await isPortOpen()) throw new Error(`${baseUrl} is already in use`);
  const child = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const remember = (chunk) => { log = `${log}${chunk}`.slice(-5000); };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/area/umeda/`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await stopServer(child);
  throw new Error(`server was not ready\n${log}`);
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
      check(await page.locator("#ranking").count() === 0, `live ${area.slug} ${viewport.width}px fake ranking=0`);
      check(await page.getByRole("button", { name: "初心者向け", exact: true }).count() === 0, `live ${area.slug} ${viewport.width}px empty beginner filter=0`);
      check(await page.getByRole("button", { name: "駅名・徒歩案内あり", exact: true }).count() === 0, `live ${area.slug} ${viewport.width}px station filter=0`);
      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
      check(geometry.body <= geometry.viewport + 1, `live ${area.slug} ${viewport.width}px overflow=0`, geometry);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      check(canonical === `https://mens-esthe-kuchikomi.com/area/${area.slug}/`, `live ${area.slug} ${viewport.width}px canonical unchanged`, { canonical });
      if (viewport.width === 320 || viewport.width === 1440) {
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.hl-fade-in{opacity:1!important;transform:none!important}" });
        const file = path.join(screenshotDir, `live-${area.slug}-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        screenshotFiles.push(file);
        screenshotCount += 1;
      }
    }
  }
  await page.close();
}

await fs.access(path.join(projectRoot, ".next", "BUILD_ID"));
await fs.rm(reportDir, { recursive: true, force: true });
await fs.mkdir(screenshotDir, { recursive: true });

const preview = JSON.parse(await fs.readFile(path.join(repositoryRoot, "docs", "data-clean", "priority5", "primary-area-backfill-preview-2026-08-16.json"), "utf8"));
const classifier = await loadClassifier();
await verifyProductionTemplateContract();
let browser;
let server;
try {
  browser = await chromium.launch({ headless: true });
  await runFixtureQa(browser, classifier, preview);
  server = await startServer();
  await runLiveFailSafeQa(browser);
} catch (error) {
  failures.push({ label: "browser runner completed", details: { message: String(error?.stack || error) } });
} finally {
  await browser?.close();
  await stopServer(server);
}

const summary = {
  modes: { fixture: 55, liveFailSafe: 55 },
  scenarios,
  assertions,
  screenshots: screenshotCount,
  screenshotFiles,
  failures,
};
await fs.writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
