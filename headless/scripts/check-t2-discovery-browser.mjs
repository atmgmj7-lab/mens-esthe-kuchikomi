import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3112;
const baseUrl = `http://127.0.0.1:${port}`;
const reportDir = path.join(projectRoot, "reports", "ux-prod-t2");
const screenshotDir = path.join(reportDir, "screenshots");
const require = createRequire(import.meta.url);

const viewports = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 760, height: 900 },
  { width: 761, height: 900 },
  { width: 900, height: 900 },
  { width: 901, height: 900 },
  { width: 1024, height: 900 },
  { width: 1025, height: 900 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
];

const routes = [
  { name: "home", pathname: "/" },
  { name: "reviews", pathname: "/reviews/" },
  { name: "reviews-empty", pathname: "/reviews/?q=__eskomi_no_match__" },
  { name: "review-submit", pathname: "/reviews/submit/" },
  { name: "area-umeda", pathname: "/area/umeda/" },
];

const priorityAreaPaths = [
  "/area/sakai/",
  "/area/shinosaka/",
  "/area/umeda/",
  "/area/sakaisujihonmachi/",
  "/area/nihonbashi/",
];

let assertions = 0;
let scenarios = 0;
let screenshotCount = 0;
const failures = [];
const screenshots = [];

function check(condition, label, details = {}) {
  assertions += 1;
  if (!condition) failures.push({ label, details });
}

function parseCssRgb(value) {
  const channels = value.match(/[\d.]+/gu)?.slice(0, 3).map(Number) ?? [];
  if (channels.length !== 3) throw new Error(`Unsupported CSS color: ${value}`);
  return channels.map((channel) => channel / 255);
}

function relativeLuminance(value) {
  const channels = parseCssRgb(value).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(left, right) {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05);
}

async function renderReviewCardFixture() {
  const componentFile = path.join(projectRoot, "components", "reviews", "ReviewCard.tsx");
  const cssFile = path.join(projectRoot, "components", "reviews", "ReviewsHub.module.css");
  const [source, css] = await Promise.all([
    fs.readFile(componentFile, "utf8"),
    fs.readFile(cssFile, "utf8"),
  ]);
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: componentFile,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) throw new Error("ReviewCard.tsx did not transpile for T2 browser QA");

  const loaded = { exports: {} };
  const cssIdentity = new Proxy({}, {
    get: (_target, property) => property === "__esModule" ? false : String(property),
  });
  const link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
  const localRequire = (specifier) => {
    if (specifier === "next/link") return { __esModule: true, default: link };
    if (specifier === "./ReviewsHub.module.css") return cssIdentity;
    return require(specifier);
  };
  new Function("require", "module", "exports", result.outputText)(localRequire, loaded, loaded.exports);
  const { ReviewCard } = loaded.exports;
  const baseReview = {
    id: 9001,
    body: "公開店舗に紐づく承認済みユーザー口コミの表示確認です。長い本文でもカードの幅を越えずに読み進められます。",
    submittedAt: "2026-08-16T09:00:00+09:00",
    ratings: { total: 5, price: 4, service: 5, cleanliness: 4 },
    shop: {
      id: 7001,
      slug: "long-japanese-shop-name",
      name: "大阪日本橋と堺筋本町の間にあるとても長い名称のメンズエステ店舗",
    },
    areas: [
      { id: 51, slug: "osaka", name: "大阪" },
      { id: 52, slug: "nihonbashi", name: "大阪日本橋" },
    ],
  };
  const markup = renderToStaticMarkup(
    React.createElement(
      "div",
      { className: "reviewGrid" },
      React.createElement(ReviewCard, { review: baseReview }),
      React.createElement(ReviewCard, {
        review: {
          ...baseReview,
          id: 9002,
          shop: { id: 7002, slug: "second-approved-shop", name: "新大阪承認店舗" },
        },
      }),
    ),
  );
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#fbfaf6}.page{padding:24px}${css}</style></head><body><main class="page" data-review-card-fixture="true">${markup}</main></body></html>`;
}

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
}

async function startServer() {
  if (await isPortOpen()) {
    throw new Error(`${baseUrl} is already in use; refusing to reuse an unknown server`);
  }
  const child = spawn(
    "npm",
    ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );
  let startupLog = "";
  const remember = (chunk) => {
    startupLog = `${startupLog}${chunk}`.slice(-5000);
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);

  try {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`server exited before ready\n${startupLog}`);
      try {
        const response = await fetch(`${baseUrl}/reviews/`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) return child;
      } catch {
        // The dedicated production server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`server was not ready within 45 seconds\n${startupLog}`);
  } catch (error) {
    await stopServer(child);
    throw error;
  }
}

async function assertSsrAndSeo() {
  const homeHtml = await (await fetch(`${baseUrl}/`)).text();
  const reviewsResponse = await fetch(`${baseUrl}/reviews/`);
  const reviewsHtml = await reviewsResponse.text();
  const filteredResponse = await fetch(`${baseUrl}/reviews/?area=umeda&q=%E6%8E%A5%E5%AE%A2`);
  const filteredHtml = await filteredResponse.text();

  check(homeHtml.includes("知りたいことから探す"), "home start section is SSR");
  check(homeHtml.includes("重点エリアから探す"), "home priority area section is SSR");
  check(reviewsHtml.includes("関西メンズエステの口コミ・体験談"), "reviews H1 is SSR");
  check(reviewsHtml.includes("承認済みユーザー口コミ"), "reviews provenance is SSR");
  check(reviewsHtml.includes('rel="canonical" href="https://mens-esthe-kuchikomi.com/reviews/"'), "reviews self canonical");
  check(filteredHtml.includes('name="robots" content="noindex, follow"'), "filtered reviews are noindex follow");
  check(filteredHtml.includes('rel="canonical" href="https://mens-esthe-kuchikomi.com/reviews/"'), "filtered reviews canonicalize to hub");
  check(reviewsHtml.includes('"BreadcrumbList"'), "reviews BreadcrumbList is SSR");
  check(!reviewsHtml.includes("AggregateRating"), "reviews hub has no site-wide AggregateRating");
  check(!reviewsHtml.includes("掲載準備中"), "reviews hub has no unavailable feature cards");
  for (const areaPath of priorityAreaPaths) {
    check(reviewsHtml.includes(`href="${areaPath}"`), `reviews SSR priority link ${areaPath}`);
  }
}

async function assertCoreLinks() {
  for (const pathname of [
    "/reviews/",
    "/reviews/submit/",
    "/shops/",
    "/column/",
    ...priorityAreaPaths,
  ]) {
    const response = await fetch(`${baseUrl}${pathname}`, { signal: AbortSignal.timeout(60_000) });
    check(response.status < 400, `core crawlable link resolves: ${pathname}`, { status: response.status });
  }
}

async function assertReducedMotion(browser) {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const duration = await page.locator(".escomi-home-final-v2 .hl-fade-in").first().evaluate(
    (element) => getComputedStyle(element).animationDuration,
  );
  check(duration === "0s", "home discovery animation is disabled for reduced motion", { duration });
  await page.close();
}

async function assertKeyboardFocus(page) {
  await page.goto(`${baseUrl}/reviews/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('[data-reviews-hub="true"]').waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("main.hl-route-fallback").waitFor({ state: "detached", timeout: 60_000 });
  await page.locator("body").press("Tab");
  const firstFocus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const rect = element.getBoundingClientRect();
    return { tag: element.tagName, width: rect.width, height: rect.height };
  });
  check(Boolean(firstFocus?.tag), "keyboard tab reaches an element", { firstFocus });
  check((firstFocus?.width ?? 0) > 0 && (firstFocus?.height ?? 0) > 0, "focused element is visible", { firstFocus });

  const cta = page.getByRole("link", { name: "口コミを書く", exact: true }).first();
  await cta.focus();
  const ctaFocus = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      width: rect.width,
      height: rect.height,
    };
  });
  check(ctaFocus.outlineWidth !== "0px", "review CTA has visible focus outline", { ctaFocus });
  check(ctaFocus.height >= 44, "review CTA touch target is at least 44px", { ctaFocus });
  check(
    contrastRatio(ctaFocus.color, ctaFocus.backgroundColor) >= 4.5,
    "review CTA text contrast is at least 4.5:1",
    { ctaFocus },
  );
  check(
    contrastRatio(ctaFocus.outlineColor, "rgb(255, 255, 255)") >= 3,
    "review CTA focus outline contrast is at least 3:1",
    { ctaFocus },
  );

  const secondaryColors = await page.evaluate(() => {
    const eyebrow = document.querySelector('[data-reviews-hub="true"] p');
    const link = [...document.querySelectorAll('[data-reviews-hub="true"] a')]
      .find((element) => element.textContent?.includes("最新口コミへ戻る"));
    return {
      eyebrow: eyebrow ? getComputedStyle(eyebrow).color : "",
      link: link ? getComputedStyle(link).color : "",
    };
  });
  check(contrastRatio(secondaryColors.eyebrow, "rgb(255, 255, 255)") >= 4.5, "review eyebrow contrast is at least 4.5:1", { secondaryColors });
  check(contrastRatio(secondaryColors.link, "rgb(255, 255, 255)") >= 4.5, "review secondary link contrast is at least 4.5:1", { secondaryColors });
}

async function assertReviewCardFixture(browser) {
  const html = await renderReviewCardFixture();
  const page = await browser.newPage();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.setContent(html, { waitUntil: "load" });
    scenarios += 1;
    const cards = page.locator('article[data-review-card="approved-user"]');
    check(await cards.count() === 2, `review fixture ${viewport.width}px renders two production cards`);
    const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, overflow: element.scrollWidth > element.clientWidth + 1 };
    }));
    const isTwoColumns = Math.abs(boxes[0].y - boxes[1].y) < 2;
    check(viewport.width > 760 ? isTwoColumns : !isTwoColumns, `review fixture ${viewport.width}px uses approved columns`, { boxes });
    check(boxes.every((box) => !box.overflow), `review fixture ${viewport.width}px has no card overflow`, { boxes });
    check(
      await cards.first().locator('a[href="/area/osaka/"], a[href="/area/nihonbashi/"]').count() === 2,
      `review fixture ${viewport.width}px keeps every canonical area link`,
    );
    if ([320, 1440].includes(viewport.width)) {
      const file = path.join(screenshotDir, `review-card-fixture-${viewport.width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      screenshots.push(file);
      screenshotCount += 1;
    }
  }
  await page.close();
}

async function assertRouteAtWidth(page, route, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto(`${baseUrl}${route.pathname}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const contentSelector = route.name === "home"
    ? "main.escomi-home-final-v2"
    : route.name === "reviews" || route.name === "reviews-empty"
      ? '[data-reviews-hub="true"]'
      : "main:not(.hl-route-fallback)";
  await page.locator(contentSelector).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("main.hl-route-fallback").waitFor({ state: "detached", timeout: 60_000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  scenarios += 1;
  check(response?.status() === 200, `${route.name} ${viewport.width}px returns 200`, { status: response?.status() });
  check(await page.locator("h1:visible").count() === 1, `${route.name} ${viewport.width}px has one visible H1`);
  check(await page.locator("main").count() === 1, `${route.name} ${viewport.width}px has one settled main`);

  const geometry = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
  }));
  check(
    geometry.bodyScrollWidth <= geometry.bodyClientWidth + 1 &&
      geometry.documentScrollWidth <= geometry.documentClientWidth + 1,
    `${route.name} ${viewport.width}px has no horizontal overflow`,
    geometry,
  );

  const header = page.locator("header.escomi-final-site-header");
  const footer = page.locator("footer.escomi-final-site-footer");
  check(await header.count() === 1, `${route.name} ${viewport.width}px has header`);
  check(await footer.count() === 1, `${route.name} ${viewport.width}px has footer`);

  if (route.name === "home") {
    const order = await page.locator("main h2").allTextContents();
    const positions = [
      order.findIndex((value) => value.includes("知りたいことから探す")),
      order.findIndex((value) => value.includes("新着口コミ・体験")),
      order.findIndex((value) => value.includes("関西メンズエステの最新情報")),
      order.findIndex((value) => value.includes("重点エリア")),
    ];
    const visiblePositions = positions.filter((value) => value >= 0);
    check(positions[0] >= 0, `home ${viewport.width}px has discovery start`);
    check(positions[2] >= 0, `home ${viewport.width}px has real-data Updates when source exists`);
    check(positions[3] >= 0, `home ${viewport.width}px has priority areas`);
    check(visiblePositions.every((value, index) => index === 0 || value > visiblePositions[index - 1]), `home ${viewport.width}px section order`, { order });
    check(await page.getByText("関西全体Ranking", { exact: false }).count() === 0, `home ${viewport.width}px hides unavailable ranking`);
  }

  if (route.name === "reviews") {
    const cards = page.locator("article[data-review-card]");
    const cardCount = await cards.count();
    const emptyCount = await page.getByText(/口コミ情報を現在取得できません|現在表示できる承認済み口コミはありません/).count();
    check(cardCount > 0 || emptyCount > 0, `reviews ${viewport.width}px has cards or honest state`, { cardCount, emptyCount });
    if (cardCount > 1) {
      const cardBoxes = await cards.evaluateAll((elements) => elements.slice(0, 2).map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      }));
      const isTwoColumns = Math.abs(cardBoxes[0].y - cardBoxes[1].y) < 2;
      check(viewport.width > 760 ? isTwoColumns : !isTwoColumns, `reviews ${viewport.width}px card columns`, { cardBoxes });

      await cards.first().evaluate((card) => {
        const links = [...card.querySelectorAll("a")];
        const shopLink = links.find((link) => link.getAttribute("href")?.startsWith("/shops/"));
        if (shopLink) shopLink.textContent = "大阪日本橋と堺筋本町の間にあるとても長い名称のメンズエステ店舗情報を見る";
      });
      const longNameOverflow = await cards.first().evaluate((card) => card.scrollWidth > card.clientWidth + 1);
      check(!longNameOverflow, `reviews ${viewport.width}px long Japanese shop name does not overflow`);
    }
    for (const areaPath of priorityAreaPaths) {
      check(await page.locator(`a[href="${areaPath}"]`).count() > 0, `reviews ${viewport.width}px links ${areaPath}`);
    }
  }

  if (route.name === "reviews-empty") {
    const filteredEmpty = await page.getByText("条件に一致する口コミはありません", { exact: true }).count();
    const unavailable = await page.getByText("口コミ情報を現在取得できません", { exact: true }).count();
    check(filteredEmpty === 1 || unavailable === 1, `reviews empty or unavailable state ${viewport.width}px`, { filteredEmpty, unavailable });
  }

  if ([320, 390, 1024, 1440].includes(viewport.width) && ["home", "reviews"].includes(route.name)) {
    await page.addStyleTag({
      content: `
        *, *::before, *::after { animation: none !important; transition: none !important; }
        .hl-fade-in { opacity: 1 !important; transform: none !important; }
      `,
    });
    const file = path.join(screenshotDir, `${route.name}-${viewport.width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    screenshots.push(file);
    screenshotCount += 1;
  }
}

await fs.access(path.join(projectRoot, ".next", "BUILD_ID"));
await fs.rm(reportDir, { recursive: true, force: true });
await fs.mkdir(screenshotDir, { recursive: true });

let server;
let browser;
try {
  server = await startServer();
  await assertSsrAndSeo();
  await assertCoreLinks();
  browser = await chromium.launch({ headless: true });
  await assertReducedMotion(browser);
  const page = await browser.newPage();
  await assertKeyboardFocus(page);
  for (const viewport of viewports) {
    for (const route of routes) await assertRouteAtWidth(page, route, viewport);
  }
  await assertReviewCardFixture(browser);
} catch (error) {
  failures.push({ label: "browser runner completed", details: { message: String(error?.stack || error) } });
} finally {
  await browser?.close();
  await stopServer(server);
}

const summary = {
  scenarios,
  assertions,
  screenshots: screenshotCount,
  screenshotFiles: screenshots,
  failures,
};
await fs.writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
