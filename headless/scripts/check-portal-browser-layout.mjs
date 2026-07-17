import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBaseUrl = "http://127.0.0.1:3100";
const baseUrl = (process.env.PORTAL_BASE_URL || defaultBaseUrl).replace(/\/$/, "");
const shopPath =
  "/shops/milk-tea%ef%bc%88%e3%83%9f%e3%83%ab%e3%82%af%e3%83%86%e3%82%a3%e3%83%bc%ef%bc%89/";
const reportDir = path.join(projectRoot, "reports", "portal-ux-2026-07-17");
const routes = [
  { name: "shop-milk-tea", path: shopPath, kind: "shop" },
  { name: "area-sakaisujihonmachi", path: "/area/sakaisujihonmachi/", kind: "hub" },
  { name: "area-osaka", path: "/area/osaka/", kind: "area" },
  { name: "shops", path: "/shops/", kind: "shops" }
];
const standardViewports = [
  { name: "1440", width: 1440, height: 1000, screenshot: true },
  { name: "1280", width: 1280, height: 900, screenshot: true },
  { name: "1024", width: 1024, height: 900, screenshot: true },
  { name: "768", width: 768, height: 1024, screenshot: true },
  { name: "500", width: 500, height: 900, screenshot: true },
  { name: "390", width: 390, height: 844, screenshot: true },
  { name: "375", width: 375, height: 812, screenshot: true },
  { name: "320x568", width: 320, height: 568, screenshot: true }
];
const boundaryViewports = [
  { name: "760-boundary", width: 760, height: 900 },
  { name: "761-boundary", width: 761, height: 900 },
  { name: "900-boundary", width: 900, height: 900 },
  { name: "901-boundary", width: 901, height: 900 },
  { name: "1025-boundary", width: 1025, height: 900 },
  { name: "phone-landscape", width: 667, height: 375 }
];
const viewports = [...standardViewports, ...boundaryViewports];
// Test-only review and smoke hooks keep focused probes fast and are inert in normal runs.
const testHook = process.env.PORTAL_QA_TEST_HOOK || "";
const headed = process.env.PORTAL_QA_HEADED === "1";
const summaryFileName = testHook === "smoke" ? "summary-headless-smoke.json" : "summary.json";
const runViewports = testHook ? viewports.slice(0, 1) : viewports;
const runRoutes = testHook ? routes.slice(0, 1) : routes;

function isPortOpen(port) {
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

async function startServer() {
  if (process.env.PORTAL_BASE_URL) return null;
  if (await isPortOpen(3100)) {
    throw new Error("127.0.0.1:3100 is already in use; refusing to reuse an unknown server");
  }

  const child = spawn(
    "npm",
    ["run", "start", "--", "--hostname", "127.0.0.1", "--port", "3100"],
    {
      cwd: projectRoot,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let startupLog = "";
  const remember = (chunk) => {
    startupLog = `${startupLog}${chunk}`.slice(-4000);
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);

  try {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`portal server exited before ready\n${startupLog}`);
      }
      try {
        const response = await fetch(`${defaultBaseUrl}${shopPath}`, {
          signal: AbortSignal.timeout(2_000)
        });
        if (response.ok) return child;
      } catch {
        // The dedicated production server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`portal server was not ready within 45 seconds\n${startupLog}`);
  } catch (error) {
    await stopServer(child);
    throw error;
  }
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const signal = (name) => {
    try {
      if (process.platform === "win32") child.kill(name);
      else process.kill(-child.pid, name);
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  };
  signal("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);
  if (child.exitCode === null) {
    signal("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000))
    ]);
  }
}

const failures = [];
let assertionCount = 0;
let screenshotCount = 0;
let completedScenarios = 0;
const screenshotFiles = [];
const startedAt = new Date().toISOString();
const runId = `${startedAt.replace(/[:.]/g, "-")}-${process.pid}`;
const runScreenshotDir = path.join(reportDir, "runs", runId);

function check(condition, label, details = {}) {
  assertionCount += 1;
  if (!condition) failures.push({ label, details });
}

function fail(label, details = {}) {
  assertionCount += 1;
  failures.push({ label, details });
}

function approximately(actual, expected, tolerance) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function sanitizeRuntimeText(value) {
  return String(value ?? "")
    .replaceAll(baseUrl, "<PORTAL_BASE_URL>")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\bsb_secret_[A-Za-z0-9_-]+\b/g, "<REDACTED_SECRET>")
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, "<REDACTED_JWT>")
    .slice(0, 2000);
}

function errorDetails(error) {
  return {
    name: sanitizeRuntimeText(error?.name || "Error"),
    message: sanitizeRuntimeText(error?.message || error)
  };
}

function isAllowedConsoleError(message) {
  const locationUrl = message.location().url;
  const text = message.text();
  const resourceNotFound =
    text === "Failed to load resource: the server responded with a status of 404 (Not Found)";
  // Chromium automatically requests this optional icon. The app has no favicon route;
  // its exact 404 does not affect page JavaScript, layout, navigation, or screenshots.
  if (locationUrl.endsWith("/favicon.ico") && resourceNotFound) return true;
  // This exact 404 is created by the intentional broken-image fallback probe.
  // No application/runtime console errors are otherwise allowlisted.
  return (
    locationUrl.endsWith("/__portal-qa-broken-image__") &&
    resourceNotFound
  );
}

function summaryFor(status) {
  return {
    status,
    runId,
    startedAt,
    completedAt: status === "running" ? null : new Date().toISOString(),
    routes: runRoutes.length,
    standardWidths: standardViewports.length,
    measuredViewports: runViewports.length,
    expectedScenarios: runRoutes.length * runViewports.length,
    completedScenarios,
    assertions: assertionCount,
    screenshots: screenshotCount,
    browserMode: headed ? "headed" : "headless",
    screenshotDirectory: path.relative(reportDir, runScreenshotDir),
    screenshotFiles,
    failures: status === "running" ? [] : failures
  };
}

async function writeSummary(status) {
  await fs.writeFile(
    path.join(reportDir, summaryFileName),
    `${JSON.stringify(summaryFor(status), null, 2)}\n`
  );
}

async function waitForStableLayout(page) {
  await page.locator("main").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}html{scroll-behavior:auto!important;}"
  });
  await page.locator("img").evaluateAll((images) => {
    for (const image of images) image.loading = "eager";
  });
  await page.evaluate(async () => {
    await Promise.race([
      Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 4_000))
    ]);
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function waitForRouteReady(page, route) {
  const required = route.kind === "shop"
    ? [
        page.locator("main[data-shop-detail-root] h1"),
        page.locator('main[data-shop-detail-root] section[aria-label="店舗画像"] img'),
        page.getByRole("navigation", { name: "店舗詳細のページ内メニュー" }),
        page.locator("main[data-shop-detail-root] [data-shop-cta-kind]:visible")
      ]
    : [
        page.locator('article[data-area-shop-card="true"]'),
        page.locator('[data-shop-cta-position="listing"]')
      ];
  if (route.kind === "hub") {
    required.push(
      page.getByRole("table", { name: "店舗比較" }),
      page.locator('[role="table"][aria-label="店舗比較"] [data-comparison-row]')
    );
  }
  await Promise.all(
    // Cache Components streams the completed route into a hidden container before
    // replacing the visible fallback. `attached` would accept that hidden payload
    // and measure the still-empty fallback, so every required part must be visible.
    required.map((locator) => locator.first().waitFor({ state: "visible", timeout: 15_000 }))
  );
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    };
    const isVisible = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const shopRoots = document.querySelectorAll("main[data-shop-detail-root]");
    const shopRoot = shopRoots[0];
    const shell = shopRoot?.querySelector(":scope > div");
    const detailArticle = shell?.querySelector(':scope > article[data-shop-profile-grid="true"]');
    const title = shopRoot?.querySelector("h1");
    const hero = detailArticle?.querySelector(":scope > header");
    const visual = detailArticle?.querySelector(':scope > section[aria-label="店舗画像"]');
    const mainImage = visual?.querySelector("figure > div");
    const factValues = [...(hero?.querySelectorAll("dl dd") ?? [])]
      .filter(isVisible)
      .map((value) => ({
        text: value.textContent?.trim() || "",
        size: Number.parseFloat(getComputedStyle(value).fontSize)
      }));
    const imageSelector = [
      'main[data-shop-detail-root] section[aria-label="店舗画像"] img',
      'article[data-area-shop-card="true"] img',
      '[role="table"][aria-label="店舗比較"] img'
    ].join(",");
    const images = [...document.querySelectorAll(imageSelector)]
      .filter(isVisible)
      .map((image) => ({
        alt: image.getAttribute("alt") || "",
        box: rect(image)
      }));
    const ctas = [...document.querySelectorAll("[data-shop-cta-kind]")]
      .filter(isVisible)
      .map((cta) => ({
        kind: cta.getAttribute("data-shop-cta-kind"),
        position: cta.getAttribute("data-shop-cta-position"),
        box: rect(cta)
      }));
    const cardElements = [...document.querySelectorAll('article[data-area-shop-card="true"]')]
      .filter(isVisible);
    const cardListOwner = (card) => {
      let ancestor = card.parentElement;
      while (ancestor && ancestor !== document.body) {
        const visibleCards = [...ancestor.querySelectorAll('article[data-area-shop-card="true"]')]
          .filter(isVisible);
        if (visibleCards.length > 1) return ancestor;
        ancestor = ancestor.parentElement;
      }
      return card.parentElement;
    };
    const cardParents = [...new Set(cardElements.map(cardListOwner))];
    const cards = cardElements
      .map((card) => {
        const children = [...card.children];
        const rank = card.querySelector('[aria-label^="おすすめランキング"]');
        const rankParts = rank ? [...rank.children] : [];
        const header = card.querySelector(":scope > header");
        const title = header?.querySelector(":scope > h3");
        const mediaWrap = children.find((child) =>
          child.querySelector(':scope > a[aria-label$="の詳細を見る"]')
        );
        const media = mediaWrap?.querySelector(':scope > a[aria-label$="の詳細を見る"]');
        const mediaWrapIndex = children.indexOf(mediaWrap);
        const body = mediaWrapIndex >= 0 ? children[mediaWrapIndex + 1] : null;
        const actionSlot = mediaWrapIndex >= 0 ? children[mediaWrapIndex + 2] : null;
        const cardImages = media?.querySelectorAll(":scope > img") ?? [];
        const cardCtas = card.querySelectorAll('[data-shop-cta-position="listing"]');
        return {
          listIndex: cardParents.indexOf(cardListOwner(card)),
          box: rect(card),
          mediaWrapCount: mediaWrap ? 1 : 0,
          mediaCount: media ? 1 : 0,
          headerCount: header ? 1 : 0,
          bodyCount: body?.tagName === "DIV" ? 1 : 0,
          imageCount: cardImages.length,
          actionSlotCount: actionSlot?.tagName === "DIV" ? 1 : 0,
          ctaCount: cardCtas.length,
          rank: rect(rank),
          rankParentIsMediaWrap: Boolean(rank && rank.parentElement === mediaWrap),
          rankNumber: rect(rankParts[0]),
          rankUnit: rect(rankParts[1]),
          mediaWrap: rect(mediaWrap),
          media: rect(media),
          header: rect(header),
          title: rect(title),
          body: rect(body),
          image: rect(cardImages[0]),
          actions: rect(actionSlot)
        };
      });
    const comparisons = document.querySelectorAll('[role="table"][aria-label="店舗比較"]');
    const comparison = comparisons[0];
    const comparisonHeader = comparison?.querySelector('[role="row"]');
    const comparisonRow = comparison?.querySelector('[data-comparison-row]');
    const groups = [...document.querySelectorAll('[role="group"][aria-label="予約・公式情報"]')];
    const visibleGroups = groups.filter(isVisible);
    const fixedGroup = groups.find((group) =>
      group.querySelector('[data-shop-cta-position="fixed"]')
    );

    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dpr: window.devicePixelRatio,
      scale: window.visualViewport?.scale ?? 1,
      h1: title?.textContent?.trim() || "",
      titleSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : null,
      factValues,
      requiredDom: {
        shopRootCount: shopRoots.length,
        shopProfileGridCount:
          shopRoot?.querySelectorAll('article[data-shop-profile-grid="true"]').length ?? 0,
        shopTitleCount: shopRoot?.querySelectorAll(":scope h1").length ?? 0,
        shopMainImageCount:
          shopRoot?.querySelectorAll('section[aria-label="店舗画像"] figure > div > img').length ?? 0,
        shopMenuCount:
          shopRoot?.querySelectorAll('nav[aria-label="店舗詳細のページ内メニュー"]').length ?? 0,
        shopCtaCount: shopRoot?.querySelectorAll("[data-shop-cta-kind]").length ?? 0,
        visibleCardCount: cards.length,
        visibleRankedCardCount: cards.filter((card) => card.rank).length,
        visibleUnrankedCardCount: cards.filter((card) => !card.rank).length,
        comparisonCount: comparisons.length,
        comparisonRowCount: comparison?.querySelectorAll("[data-comparison-row]").length ?? 0,
        visibleRouteCtaCount: ctas.length
      },
      shop: shopRoot
        ? {
            shell: rect(shell),
            profileGrid: rect(detailArticle),
            title: rect(title),
            hero: rect(hero),
            visual: rect(visual),
            mainImage: rect(mainImage),
            fixedGroup: rect(fixedGroup),
            fixedDisplay: fixedGroup ? getComputedStyle(fixedGroup).display : null,
            visibleActionGroupCount: visibleGroups.length,
            visibleActionGroups: visibleGroups.map((group) => ({
              box: rect(group),
              positions: [...group.querySelectorAll("[data-shop-cta-position]")].map((cta) =>
                cta.getAttribute("data-shop-cta-position")
              )
            }))
          }
        : null,
      images,
      ctas,
      cards,
      comparison: comparison
        ? {
            box: rect(comparison),
            headerDisplay: comparisonHeader ? getComputedStyle(comparisonHeader).display : null,
            row: rect(comparisonRow),
            rowColumns: comparisonRow ? getComputedStyle(comparisonRow).gridTemplateColumns : null
          }
        : null
    };
  });
}

function assertShopGeometry(metrics, viewport, label) {
  const shop = metrics.shop;
  check(
    Boolean(shop?.shell && shop?.profileGrid && shop?.title && shop?.hero && shop?.visual && shop?.mainImage),
    `${label} shop geometry exists`
  );
  if (!shop?.shell || !shop.profileGrid || !shop.title || !shop.hero || !shop.visual || !shop.mainImage) {
    return;
  }

  const expectedWidth = viewport.width <= 760
    ? viewport.width - 32
    : viewport.width <= 768
      ? viewport.width - 64
      : Math.min(viewport.width - 80, 1360);
  const expectedLeft = (viewport.width - expectedWidth) / 2;
  const innerPadding = viewport.width <= 760 ? 0 : 24;
  const expectedInnerLeft = expectedLeft + innerPadding;
  const expectedInnerWidth = expectedWidth - innerPadding * 2;

  check(approximately(shop.shell.x, expectedLeft, 2), `${label} shop shell start`, {
    actual: shop.shell.x,
    expected: expectedLeft
  });
  check(approximately(shop.shell.width, expectedWidth, 2), `${label} shop shell width`, {
    actual: shop.shell.width,
    expected: expectedWidth
  });
  check(approximately(shop.profileGrid.x, expectedInnerLeft, 2), `${label} shop profile start`, {
    actual: shop.profileGrid.x,
    expected: expectedInnerLeft
  });
  check(approximately(shop.profileGrid.width, expectedInnerWidth, 2), `${label} shop profile width`, {
    actual: shop.profileGrid.width,
    expected: expectedInnerWidth
  });
  check(approximately(shop.mainImage.x, expectedInnerLeft, 2), `${label} shop image start`, {
    actual: shop.mainImage.x,
    expected: expectedInnerLeft
  });

  const maxTitleSize = viewport.width <= 760 ? 26 : 34;
  check(metrics.titleSize <= maxTitleSize + 0.2, `${label} shop title size upper bound`, {
    actual: metrics.titleSize,
    maximum: maxTitleSize
  });
  check(metrics.factValues.length >= 1, `${label} shop fact values exist`, {
    count: metrics.factValues.length
  });
  for (const [index, fact] of metrics.factValues.entries()) {
    check(fact.size <= 18.2, `${label} shop fact ${index + 1} size upper bound`, {
      text: fact.text,
      actual: fact.size,
      maximum: 18
    });
  }
  check(shop.visibleActionGroupCount === 1, `${label} one visible booking group`, {
    count: shop.visibleActionGroupCount,
    groups: shop.visibleActionGroups
  });

  if (viewport.width > 1024) {
    check(approximately(shop.hero.width, 320, 2), `${label} shop hero width`, {
      actual: shop.hero.width,
      expected: 320
    });
    check(approximately(shop.hero.x - shop.visual.right, 32, 4), `${label} shop column gap`, {
      actual: shop.hero.x - shop.visual.right,
      expected: 32
    });
    check(approximately(shop.title.x, shop.hero.x, 2), `${label} shop title in hero column`, {
      titleX: shop.title.x,
      heroX: shop.hero.x
    });
  } else {
    check(approximately(shop.title.x, expectedInnerLeft, 2), `${label} shop title start`, {
      actual: shop.title.x,
      expected: expectedInnerLeft
    });
  }

  if (viewport.width <= 760) {
    check(shop.fixedDisplay !== "none" && shop.fixedGroup?.height >= 64, `${label} fixed actions visible`, {
      display: shop.fixedDisplay,
      box: shop.fixedGroup
    });
    if (shop.fixedGroup) {
      check(approximately(shop.fixedGroup.bottom, viewport.height, 2), `${label} fixed actions bottom`, {
        actual: shop.fixedGroup.bottom,
        expected: viewport.height
      });
    }
  } else {
    check(shop.fixedDisplay === "none", `${label} fixed actions hidden above 760`, {
      display: shop.fixedDisplay
    });
  }
}

function assertCardGeometry(metrics, viewport, label) {
  for (const [index, card] of metrics.cards.entries()) {
    const cardLabel = `${label} card ${index + 1}`;
    check(card.mediaWrapCount === 1, `${cardLabel} required media wrapper`, {
      count: card.mediaWrapCount
    });
    check(card.mediaCount === 1, `${cardLabel} required media`, { count: card.mediaCount });
    check(card.headerCount === 1, `${cardLabel} required header`, { count: card.headerCount });
    check(card.bodyCount === 1, `${cardLabel} required body`, { count: card.bodyCount });
    check(card.imageCount === 1, `${cardLabel} required image`, { count: card.imageCount });
    check(card.actionSlotCount === 1, `${cardLabel} required action slot`, {
      count: card.actionSlotCount,
      ctaCount: card.ctaCount
    });
    if (card.rankNumber && card.rankUnit) {
      check(
        Math.abs(card.rankNumber.top - card.rankUnit.top) <= 2,
        `${cardLabel} rank alignment`,
        { numberTop: card.rankNumber.top, unitTop: card.rankUnit.top }
      );
    }
    if (card.rank) {
      check(card.rankParentIsMediaWrap, `${cardLabel} rank belongs to media wrapper`);
      check(
        Boolean(
          card.mediaWrap &&
            card.rank.top >= card.mediaWrap.top - 2 &&
            card.rank.right <= card.mediaWrap.right + 2 &&
            card.rank.bottom <= card.mediaWrap.bottom + 2 &&
            card.rank.x >= card.mediaWrap.x - 2
        ),
        `${cardLabel} rank contained by media wrapper`,
        { rank: card.rank, mediaWrap: card.mediaWrap }
      );
    }
    const hasGeometryParts = Boolean(
      card.box && card.mediaWrap && card.media && card.header && card.title && card.body && card.image
    );
    check(hasGeometryParts, `${cardLabel} required geometry parts`);

    if (hasGeometryParts && viewport.width > 900) {
      const gap = viewport.width <= 1024 ? 20 : 24;
      const mediaWidth = viewport.width <= 1280 ? 220 : 240;
      const actionWidth = viewport.width <= 1024 ? 148 : 164;
      check(approximately(card.mediaWrap.x, card.box.x, 2), `${cardLabel} media wrapper start`, {
        actual: card.mediaWrap.x,
        expected: card.box.x
      });
      check(approximately(card.media.x, card.box.x, 2), `${cardLabel} media start`, {
        actual: card.media.x,
        expected: card.box.x
      });
      check(approximately(card.media.width, mediaWidth, 2), `${cardLabel} media width`, {
        actual: card.media.width,
        expected: mediaWidth
      });
      check(approximately(card.header.x - card.media.right, gap, 4), `${cardLabel} media-info gap`, {
        actual: card.header.x - card.media.right,
        expected: gap
      });
      if (card.actions?.width > 0) {
        check(approximately(card.actions.width, actionWidth, 2), `${cardLabel} action width`, {
          actual: card.actions.width,
          expected: actionWidth
        });
        check(approximately(card.actions.right, card.box.right, 2), `${cardLabel} action end`, {
          actual: card.actions.right,
          expected: card.box.right
        });
      }
    } else if (hasGeometryParts) {
      check(approximately(card.media.x, card.box.x, 2), `${cardLabel} stacked media start`, {
        actual: card.media.x,
        expected: card.box.x
      });
      check(approximately(card.media.width, card.box.width, 2), `${cardLabel} stacked media width`, {
        actual: card.media.width,
        expected: card.box.width
      });
      if (card.actions?.width > 0) {
        check(approximately(card.actions.x, card.box.x, 2), `${cardLabel} stacked action start`, {
          actual: card.actions.x,
          expected: card.box.x
        });
        check(approximately(card.actions.width, card.box.width, 2), `${cardLabel} stacked action width`, {
          actual: card.actions.width,
          expected: card.box.width
        });
      }
    }

    if (viewport.width <= 760) {
      check(card.box.x >= 15 && card.box.right <= viewport.width - 15, `${cardLabel} mobile gutters`, {
        box: card.box,
        viewportWidth: viewport.width
      });
    }
  }

  const cardsByList = new Map();
  for (const card of metrics.cards) {
    const listCards = cardsByList.get(card.listIndex) ?? [];
    listCards.push(card);
    cardsByList.set(card.listIndex, listCards);
  }
  for (const [listIndex, cards] of cardsByList) {
    const rankedCards = cards.filter((card) => card.rank && card.media && card.title);
    const unrankedCards = cards.filter((card) => !card.rank && card.media && card.title);
    if (rankedCards.length === 0 || unrankedCards.length === 0) continue;
    const comparableCards = [...rankedCards, ...unrankedCards];
    const mediaXs = comparableCards.map((card) => card.media.x);
    const titleXs = comparableCards.map((card) => card.title.x);
    check(
      Math.max(...mediaXs) - Math.min(...mediaXs) <= 2,
      `${label} list ${listIndex + 1} ranked and unranked media x parity`,
      { mediaXs }
    );
    check(
      Math.max(...titleXs) - Math.min(...titleXs) <= 2,
      `${label} list ${listIndex + 1} ranked and unranked title x parity`,
      { titleXs }
    );
  }
}

function assertRequiredRouteDom(metrics, route, label) {
  const dom = metrics.requiredDom;
  if (route.kind === "shop") {
    check(dom.shopRootCount === 1, `${label} requires one shop root`, {
      count: dom.shopRootCount
    });
    check(dom.shopProfileGridCount === 1, `${label} requires one shop profile grid`, {
      count: dom.shopProfileGridCount
    });
    check(dom.shopTitleCount === 1, `${label} requires one shop title`, {
      count: dom.shopTitleCount
    });
    check(dom.shopMainImageCount === 1, `${label} requires one shop main image`, {
      count: dom.shopMainImageCount
    });
    check(dom.shopMenuCount === 1, `${label} requires one shop section menu`, {
      count: dom.shopMenuCount
    });
    check(dom.shopCtaCount >= 1, `${label} requires shop CTA`, {
      count: dom.shopCtaCount
    });
    return;
  }

  check(dom.visibleCardCount >= 1, `${label} requires visible shop cards`, {
    count: dom.visibleCardCount
  });
  // Sparse WordPress records intentionally render zero per-card actions; the shared
  // AreaShopCard action slot remains mandatory and each representative route must
  // still expose at least one real, non-invented CTA across its visible cards.
  check(dom.visibleRouteCtaCount >= 1, `${label} requires a real route CTA`, {
    count: dom.visibleRouteCtaCount
  });

  if (route.kind === "hub" || route.kind === "area") {
    check(dom.visibleRankedCardCount >= 1, `${label} requires ranked shop cards`, {
      count: dom.visibleRankedCardCount
    });
    check(dom.visibleUnrankedCardCount >= 1, `${label} requires unranked shop cards`, {
      count: dom.visibleUnrankedCardCount
    });
  }

  if (route.kind === "hub") {
    check(dom.comparisonCount === 1, `${label} requires one comparison`, {
      count: dom.comparisonCount
    });
    check(dom.comparisonRowCount >= 1, `${label} requires comparison rows`, {
      count: dom.comparisonRowCount
    });
  }
}

function assertRuntimeGeometry(metrics, route, viewport) {
  const label = `${route.name} ${viewport.name}`;
  assertRequiredRouteDom(metrics, route, label);
  check(metrics.scrollWidth === metrics.clientWidth, `${label} document scroll width`, {
    scrollWidth: metrics.scrollWidth,
    clientWidth: metrics.clientWidth
  });
  check(metrics.bodyScrollWidth <= metrics.clientWidth, `${label} body scroll width`, {
    bodyScrollWidth: metrics.bodyScrollWidth,
    clientWidth: metrics.clientWidth
  });
  check(metrics.dpr === 1, `${label} DPR 1`, { actual: metrics.dpr });
  check(metrics.scale === 1, `${label} zoom 100`, { actual: metrics.scale });

  for (const [index, image] of metrics.images.entries()) {
    const ratio = image.box.width / image.box.height;
    check(Math.abs(ratio - 4 / 3) / (4 / 3) <= 0.005, `${label} image ${index + 1} ratio 4:3`, {
      alt: image.alt,
      width: image.box.width,
      height: image.box.height,
      ratio
    });
  }
  for (const [index, cta] of metrics.ctas.entries()) {
    check(cta.box.height >= 44, `${label} CTA ${index + 1} height`, {
      kind: cta.kind,
      position: cta.position,
      height: cta.box.height
    });
  }

  if (route.kind === "shop") {
    check(metrics.h1.includes("milk tea"), `${label} real milk-tea title`, { actual: metrics.h1 });
    assertShopGeometry(metrics, viewport, label);
  } else {
    assertCardGeometry(metrics, viewport, label);
  }

  if (route.kind === "hub") {
    check(Boolean(metrics.comparison), `${label} comparison exists`);
    if (metrics.comparison) {
      const mobile = viewport.width <= 760;
      check(
        mobile ? metrics.comparison.headerDisplay === "none" : metrics.comparison.headerDisplay !== "none",
        `${label} comparison switches at 760`,
        { display: metrics.comparison.headerDisplay }
      );
      if (mobile && metrics.comparison.row) {
        check(
          metrics.comparison.row.width <= metrics.comparison.box.width + 2,
          `${label} comparison card contained`,
          { row: metrics.comparison.row, table: metrics.comparison.box }
        );
      }
    }
  }
}

async function checkLongTitle(page, viewport, label) {
  const fixtures = [
    { name: "natural", value: "PREMIUM RELAXATION SALON大阪日本橋（全角括弧）" },
    { name: "unbroken", value: "UNBROKENLATINSHOPNAMETOKEN" }
  ];
  const results = await page.evaluate((titleFixtures) => {
    const title = document.querySelector("main[data-shop-detail-root] h1");
    const shell = document.querySelector("main[data-shop-detail-root] > div");
    if (!title || !shell) return null;
    const original = title.textContent;
    const measured = titleFixtures.map((fixture) => {
      title.textContent = fixture.value;
      const titleBox = title.getBoundingClientRect();
      const shellBox = shell.getBoundingClientRect();
      return {
        ...fixture,
        documentScrollWidth: document.documentElement.scrollWidth,
        documentClientWidth: document.documentElement.clientWidth,
        titleScrollWidth: title.scrollWidth,
        titleClientWidth: title.clientWidth,
        titleRight: titleBox.right,
        shellRight: shellBox.right,
        lines: Math.round(titleBox.height / Number.parseFloat(getComputedStyle(title).lineHeight))
      };
    });
    title.textContent = original;
    return measured;
  }, fixtures);
  check(Boolean(results), `${label} long title fixtures exist`);
  if (!results) return;
  for (const result of results) {
    const fixtureLabel = `${label} ${result.name} title`;
    check(result.documentScrollWidth === result.documentClientWidth, `${fixtureLabel} document containment`, result);
    check(result.titleScrollWidth <= result.titleClientWidth + 1, `${fixtureLabel} box containment`, result);
    check(result.titleRight <= result.shellRight + 2, `${fixtureLabel} shell containment`, result);
    check(result.lines >= 1 && result.lines <= 3, `${fixtureLabel} uses at most 3 lines`, result);
  }
}

async function checkShopInteractions(page, viewport) {
  const label = `shop-milk-tea ${viewport.name} interactions`;
  const menu = page.getByRole("navigation", { name: "店舗詳細のページ内メニュー" });
  const firstLink = menu.getByRole("link").first();
  check((await firstLink.count()) === 1, `${label} menu anchor exists`);
  if ((await firstLink.count()) !== 1) return;

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  let keyboardFocused = false;
  let outline = null;
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const active = document.activeElement;
      const inMenu = Boolean(active?.closest('nav[aria-label="店舗詳細のページ内メニュー"]'));
      if (!inMenu || !(active instanceof HTMLElement)) return { inMenu, outline: null };
      const style = getComputedStyle(active);
      return { inMenu, outline: `${style.outlineStyle} ${style.outlineWidth}` };
    });
    if (focusState.inMenu) {
      keyboardFocused = true;
      outline = focusState.outline;
      break;
    }
  }
  check(keyboardFocused, `${label} keyboard reaches menu`);
  check(Boolean(outline && !outline.startsWith("none") && !outline.endsWith("0px")), `${label} focus visible`, {
    outline
  });

  const href = await firstLink.getAttribute("href");
  check(Boolean(href?.startsWith("#")), `${label} menu uses internal anchor`, { href });
  if (href?.startsWith("#")) {
    await firstLink.click();
    await page.waitForFunction((hash) => window.location.hash === hash, href);
    const anchorGeometry = await page.evaluate((id) => {
      const target = document.getElementById(id.slice(1));
      const header = document.querySelector(".escomi-final-site-header");
      const nav = document.querySelector('nav[aria-label="店舗詳細のページ内メニュー"]');
      const targetBox = target?.getBoundingClientRect();
      const headingBox = target?.querySelector("h2")?.getBoundingClientRect();
      return {
        targetTop: targetBox?.top ?? null,
        headingTop: headingBox?.top ?? targetBox?.top ?? null,
        stickyBottom:
          (header?.getBoundingClientRect().height ?? 0) + (nav?.getBoundingClientRect().height ?? 0)
      };
    }, href);
    check(
      anchorGeometry.targetTop !== null && anchorGeometry.targetTop >= anchorGeometry.stickyBottom - 2,
      `${label} anchor target not hidden`,
      anchorGeometry
    );
    check(
      anchorGeometry.headingTop !== null && anchorGeometry.headingTop >= anchorGeometry.stickyBottom - 2,
      `${label} heading not hidden`,
      anchorGeometry
    );
  }

  await page.route("**/__portal-qa-broken-image__", (route) =>
    route.fulfill({ status: 404, contentType: "image/png", body: "" })
  );
  const mainImage = page.locator('main[data-shop-detail-root] section[aria-label="店舗画像"] img').first();
  await mainImage.evaluate((image) => {
    image.src = "/__portal-qa-broken-image__";
  });
  await page.waitForFunction(
    () =>
      document.querySelector('main[data-shop-detail-root] section[aria-label="店舗画像"] img')
        ?.getAttribute("data-fallback-applied") === "true"
  );
  const fallback = await mainImage.evaluate((image) => ({
    src: image.getAttribute("src"),
    alt: image.getAttribute("alt"),
    ratio: image.getBoundingClientRect().width / image.getBoundingClientRect().height
  }));
  check(fallback.src === "/images/eskomi-shop-fallback.svg", `${label} broken image fallback source`, fallback);
  check(fallback.alt === "Eskomi 店舗画像準備中", `${label} broken image fallback alt`, fallback);
  check(Math.abs(fallback.ratio - 4 / 3) / (4 / 3) <= 0.005, `${label} broken image fallback ratio`, fallback);
}

let server = null;
let browser = null;
await fs.mkdir(reportDir, { recursive: true });
await fs.mkdir(runScreenshotDir, { recursive: true });
// Invalidate any prior passed result before launch, navigation, or server work.
await writeSummary("running");

try {
  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.port === "5000") {
    throw new Error("PORTAL_BASE_URL must not target the existing out-of-scope port 5000 server");
  }
  server = await startServer();
  if (testHook === "force-after-server-start") {
    throw new Error("PORTAL_QA_TEST_HOOK force-after-server-start");
  }
  // Headless is the safe default so QA does not steal focus or interfere with
  // the user's Mac. A visible browser is opt-in for an attended visual review.
  browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce"
  });

  for (const viewport of runViewports) {
    for (const route of runRoutes) {
      const scenarioLabel = `${route.name} ${viewport.name}`;
      const runtimeIssues = [];
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const onPageError = (error) => {
        runtimeIssues.push({ type: "pageerror", ...errorDetails(error) });
      };
      const onConsole = (message) => {
        if (message.type() !== "error" || isAllowedConsoleError(message)) return;
        runtimeIssues.push({
          type: "console.error",
          message: sanitizeRuntimeText(message.text()),
          location: sanitizeRuntimeText(message.location().url)
        });
      };

      // Attach before the first navigation so hydration and resource errors cannot escape.
      page.on("pageerror", onPageError);
      page.on("console", onConsole);
      try {
        const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
        check(response?.ok() === true, `${scenarioLabel} HTTP 200`, {
          status: response?.status() ?? null
        });
        await waitForStableLayout(page);
        await waitForRouteReady(page, route);
        if (testHook === "missing-shop-menu") {
          await page.evaluate(() =>
            document.querySelector('nav[aria-label="店舗詳細のページ内メニュー"]')?.remove()
          );
        }
        if (testHook === "console-error") {
          await page.evaluate(() => console.error("PORTAL_QA_TEST_HOOK console-error"));
        }
        if (testHook === "page-error") {
          await page.evaluate(() =>
            queueMicrotask(() => {
              throw new Error("PORTAL_QA_TEST_HOOK page-error");
            })
          );
          await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
        }
        const metrics = await collectMetrics(page);
        assertRuntimeGeometry(metrics, route, viewport);

        if (viewport.screenshot) {
          const screenshotPath = path.join(
            runScreenshotDir,
            `${route.name}-${viewport.name}.png`
          );
          // The 320px listing screenshot includes every current WordPress card and
          // can be hundreds of thousands of pixels tall. Keep the complete evidence
          // instead of truncating it at Playwright's 30-second action default.
          await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 120_000 });
          screenshotCount += 1;
          screenshotFiles.push(path.relative(reportDir, screenshotPath));
        }

        if (route.kind === "shop" && [500, 390, 320].includes(viewport.width)) {
          await checkLongTitle(page, viewport, scenarioLabel);
        }
        if (route.kind === "shop" && viewport.width === 390 && viewport.height === 844) {
          await checkShopInteractions(page, viewport);
        }
        completedScenarios += 1;
        console.log(`checked ${route.name} at ${viewport.name}`);
      } finally {
        page.off("pageerror", onPageError);
        page.off("console", onConsole);
        for (const issue of runtimeIssues) {
          check(false, `${scenarioLabel} browser ${issue.type}`, issue);
        }
        try {
          await page.close();
        } catch (error) {
          fail(`${scenarioLabel} page cleanup`, errorDetails(error));
        }
      }
    }
  }
} catch (error) {
  fail("unexpected runtime failure", errorDetails(error));
} finally {
  try {
    await browser?.close();
  } catch (error) {
    fail("browser cleanup", errorDetails(error));
  }
  try {
    await stopServer(server);
  } catch (error) {
    fail("server cleanup", errorDetails(error));
  }
  if (!process.env.PORTAL_BASE_URL && (await isPortOpen(3100))) {
    fail("process cleanup", {
      message: "dedicated portal server still owns 127.0.0.1:3100 after cleanup"
    });
  }
  await writeSummary(failures.length > 0 ? "failed" : "passed");
}

if (failures.length > 0) {
  const lines = failures.slice(0, 80).map(
    (failure) => `- ${failure.label}: ${JSON.stringify(failure.details)}`
  );
  throw new Error(
    `portal browser layout check failed (${failures.length}/${assertionCount})\n${lines.join("\n")}`
  );
}

console.log(
  `portal browser layout check passed (${assertionCount} assertions, ${screenshotCount} screenshots, ${completedScenarios} scenarios)`
);
