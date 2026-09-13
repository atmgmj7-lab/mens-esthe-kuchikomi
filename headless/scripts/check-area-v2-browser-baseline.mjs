#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { extractShopViews, currentSourceFacts, currentSourcePrices } from "./lib/area-visibility-data-contract.mjs";

import {
  rawSupportingDisclosureEvidence,
  supportingHtmlText,
} from "./lib/area-supporting-ppr-contract.mjs";
import { rankingUiEvidence } from "./lib/exact-deployment-release-contract.mjs";

const CONTRACT_BASE_SHA = "e18de64df6da98866e32881dc7d6e373106f61da";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REPORT_PATH = path.join(
  PROJECT_ROOT,
  "reports",
  "area-template-v2-foundation-01a",
  "browser-baseline.json",
);
const DEFAULT_BASE_URL = "http://127.0.0.1:3147";
const DEFAULT_TIMEOUT_MS = 60_000;
const WIDTHS = [320, 375, 390, 900, 901, 1024, 1280, 1440];
const AREAS = [
  { slug: "shinosaka", label: "新大阪", details: "present", expectedItemListCount: 58 },
  { slug: "sakai", label: "堺東", details: "present", expectedItemListCount: 25 },
  { slug: "umeda", label: "梅田", details: "absent", expectedItemListCount: null },
  { slug: "sakaisujihonmachi", label: "堺筋本町", details: "absent", expectedItemListCount: null },
  { slug: "nihonbashi", label: "日本橋", details: "absent", expectedItemListCount: null },
];
const PUBLIC_ASSET_RESOURCE_TYPES = new Set(["font", "image", "media", "stylesheet"]);
const SECTION_MARKERS = [
  { key: "h1", selector: "#area-final-title", raw: /\bid=["']area-final-title["']/iu },
  {
    key: "supporting-disclosure",
    selector: 'details[data-area-supporting-disclosure="true"]',
    raw: /data-area-supporting-disclosure=["']true["']/iu,
  },
  {
    key: "coverage",
    selector: '[data-area-depth="coverage"]',
    raw: /data-area-depth=["']coverage["']/iu,
  },
  { key: "decision-guide", selector: "#area-decision-guide", raw: /\bid=["']area-decision-guide["']/iu },
  { key: "ranking", selector: "#ranking", raw: /\bid=["']ranking["']/iu },
  {
    key: "cross-source",
    selector: '[data-area-depth="portal-therapist"]',
    raw: /data-area-depth=["']portal-therapist["']/iu,
  },
  { key: "shop-list", selector: "#shop-list", raw: /\bid=["']shop-list["']/iu },
  { key: "comparison", selector: "#compare-tabs", raw: /\bid=["']compare-tabs["']/iu },
  { key: "reviews", selector: "#reviews", raw: /\bid=["']reviews["']/iu },
  { key: "price-guide", selector: "#price-guide", raw: /\bid=["']price-guide["']/iu },
  { key: "choice-guide", selector: "#how-to-choose", raw: /\bid=["']how-to-choose["']/iu },
  { key: "local-guide", selector: "#local-guide", raw: /\bid=["']local-guide["']/iu },
  { key: "faq", selector: "#faq", raw: /\bid=["']faq["']/iu },
  {
    key: "discovery-links",
    selector: "#area-discovery-links",
    raw: /\bid=["']area-discovery-links["']/iu,
  },
  { key: "related-areas", selector: "#related-areas", raw: /\bid=["']related-areas["']/iu },
];

function parseArguments(argv) {
  const flags = new Set(["help", "self-test"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`unknown argument: ${argument}`);
    const name = argument.slice(2);
    if (flags.has(name)) {
      values[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
    values[name] = value;
    index += 1;
  }
  const known = new Set([
    "base-url",
    "build-id",
    "help",
    "report-path",
    "self-test",
    "source-sha",
    "timeout-ms",
  ]);
  for (const name of Object.keys(values)) {
    if (!known.has(name)) throw new Error(`unknown argument: --${name}`);
  }
  return values;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/check-area-v2-browser-baseline.mjs --base-url http://127.0.0.1:3147 [--report-path PATH] [--source-sha SHA] [--build-id ID]",
    "  node scripts/check-area-v2-browser-baseline.mjs --self-test",
    "",
    "Environment fallbacks:",
    "  AREA_V2_BASELINE_BASE_URL, AREA_V2_BASELINE_REPORT_PATH, AREA_V2_BASELINE_SOURCE_SHA, AREA_V2_BASELINE_BUILD_ID, AREA_V2_BASELINE_TIMEOUT_MS",
  ].join("\n");
}

function requireLoopbackBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("browser baseline base URL must be a valid loopback HTTP(S) origin");
  }
  const hostname = url.hostname.toLowerCase();
  if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(hostname)) {
    throw new Error("browser baseline base URL must use a loopback hostname");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("browser baseline base URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) throw new Error("browser baseline base URL must not contain userinfo");
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("browser baseline base URL must not contain a path, query, or fragment");
  }
  return url.origin;
}

function timeoutValue(value) {
  const parsed = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 180_000) {
    throw new Error("browser baseline timeout must be an integer from 1000 to 180000 milliseconds");
  }
  return parsed;
}

function field(value) {
  return typeof value === "string" && value.trim()
    ? { status: "available", value: value.trim() }
    : { status: "missing", value: null };
}

function numericField(value) {
  return Number.isFinite(value)
    ? { status: "available", value }
    : { status: "missing", value: null };
}

function decodeHtmlText(value) {
  return String(value ?? "")
    .replace(/<!--[^]*?-->/gu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_match, value_) => String.fromCodePoint(Number(value_)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, value_) => String.fromCodePoint(Number.parseInt(value_, 16)))
    .replace(/\s+/gu, " ")
    .trim();
}

function tagAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2] ?? "";
}

function tagText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([^]*?)<\\/${tagName}>`, "iu"));
  return match ? decodeHtmlText(match[1]) : "";
}

function metaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    if (tagAttribute(match[0], "name").toLowerCase() === name.toLowerCase()) {
      return tagAttribute(match[0], "content");
    }
  }
  return "";
}

function canonicalHref(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    if (tagAttribute(match[0], "rel").toLowerCase().split(/\s+/u).includes("canonical")) {
      return tagAttribute(match[0], "href");
    }
  }
  return "";
}

function jsonLdObjectsFromHtml(html) {
  const values = [];
  const parseErrors = [];
  for (const [index, match] of [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/giu)].entries()) {
    try {
      values.push(JSON.parse(match[1]));
    } catch (error) {
      parseErrors.push({ index, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { values, parseErrors };
}

function collectSchemaNodes(value, nodes = []) {
  if (!value || typeof value !== "object") return nodes;
  if (typeof value["@type"] === "string") nodes.push(value);
  for (const nested of Object.values(value)) collectSchemaNodes(nested, nodes);
  return nodes;
}

function schemaEvidence(values, parseErrors = []) {
  const nodes = values.flatMap((value) => collectSchemaNodes(value));
  const typeCounts = {};
  for (const node of nodes) typeCounts[node["@type"]] = (typeCounts[node["@type"]] ?? 0) + 1;
  const itemLists = nodes.filter((node) => node["@type"] === "ItemList");
  return {
    values,
    scriptCount: values.length + parseErrors.length,
    validScriptCount: values.length,
    invalidScriptCount: parseErrors.length,
    parseErrors,
    typeCounts: Object.fromEntries(Object.entries(typeCounts).sort(([left], [right]) => left.localeCompare(right))),
    breadcrumbListCount: typeCounts.BreadcrumbList ?? 0,
    faqPageCount: typeCounts.FAQPage ?? 0,
    reviewCount: typeCounts.Review ?? 0,
    ratingCount: typeCounts.Rating ?? 0,
    aggregateRatingCount: typeCounts.AggregateRating ?? 0,
    itemListCount: itemLists.length,
    itemLists: itemLists.map((itemList) => ({
      numberOfItems: Number.isFinite(itemList.numberOfItems) ? itemList.numberOfItems : null,
      itemListElementCount: Array.isArray(itemList.itemListElement) ? itemList.itemListElement.length : null,
    })),
  };
}

function rawSectionOrder(html) {
  return SECTION_MARKERS
    .map(({ key, raw }) => ({ key, index: html.search(raw) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)
    .map(({ key }) => key);
}

function textFingerprint(value) {
  const normalized = decodeHtmlText(value);
  return normalized
    ? {
        status: "available",
        length: normalized.length,
        sha256: createHash("sha256").update(normalized).digest("hex"),
      }
    : { status: "missing", length: 0, sha256: null };
}

function rawSemanticEvidence(html, slug, responseHeaders = {}) {
  const { values, parseErrors } = jsonLdObjectsFromHtml(html);
  const disclosure = rawSupportingDisclosureEvidence(html);
  const ranking = rankingUiEvidence(html);
  const robots = metaContent(html, "robots");
  const xRobotsTag = responseHeaders["x-robots-tag"] ?? "";
  return {
    slug,
    title: field(tagText(html, "title")),
    metaDescription: field(metaContent(html, "description")),
    h1: field(tagText(html, "h1")),
    canonical: field(canonicalHref(html)),
    robots: field(robots),
    xRobotsTag: field(xRobotsTag),
    noindex: /\bnoindex\b/iu.test(`${robots} ${xRobotsTag}`),
    shopCardCount: (html.match(/data-area-shop-card=["']true["']/giu) ?? []).length,
    schema: schemaEvidence(values, parseErrors),
    ranking,
    details: {
      present: disclosure.disclosureHtml.length > 0,
      complete: disclosure.disclosureHtml.endsWith("</details>"),
      initiallyOpen: disclosure.disclosureHtml
        ? /<details\b[^>]*\sopen(?:\s|=|>)/iu.test(disclosure.disclosureHtml)
        : null,
      insideHiddenPprSegment: disclosure.disclosureInsideHiddenSegment,
      supportingText: textFingerprint(supportingHtmlText(disclosure.disclosureHtml)),
    },
    sectionOrder: rawSectionOrder(html),
    documentLength: html.length,
  };
}

function requestDecision({ method, resourceType, requestUrl, baseOrigin }) {
  if (method !== "GET") return { action: "abort", reason: "mutation" };
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return { action: "abort", reason: "invalid-url" };
  }
  if (url.origin === baseOrigin) return { action: "continue", reason: "loopback-read" };
  if (new Set(["data:", "blob:"]).has(url.protocol)) {
    return { action: "continue", reason: "inline-public-asset" };
  }
  if (new Set(["http:", "https:"]).has(url.protocol) && PUBLIC_ASSET_RESOURCE_TYPES.has(resourceType)) {
    return { action: "continue", reason: "external-public-asset" };
  }
  return { action: "abort", reason: "external-non-asset" };
}

function viewportHeight(width) {
  return width <= 390 ? 844 : 900;
}

function orderIndex(order, key) {
  const index = order.indexOf(key);
  return index >= 0 ? index : null;
}

function validateSectionOrder(order) {
  const failures = [];
  const supporting = order.includes("supporting-disclosure")
    ? "supporting-disclosure"
    : ["coverage", "decision-guide", "ranking", "cross-source"].find((key) => order.includes(key));
  const pairs = [
    ["h1", supporting],
    [supporting, "shop-list"],
    ["shop-list", "comparison"],
    ["comparison", "faq"],
  ];
  const finalLink = order.includes("discovery-links") ? "discovery-links" : "related-areas";
  pairs.push(["faq", finalLink]);
  for (const [before, after] of pairs) {
    if (!before || !after) continue;
    const beforeIndex = orderIndex(order, before);
    const afterIndex = orderIndex(order, after);
    if (beforeIndex === null || afterIndex === null) continue;
    if (beforeIndex >= afterIndex) failures.push(`${before} must precede ${after}`);
  }
  return { status: failures.length === 0 ? "verified" : "regression", failures };
}

function pushAssertion(report, condition, label, scenarioId, details = {}) {
  report.assertionCount += 1;
  if (!condition) report.failures.push({ label, scenarioId, details });
}

async function readBuildId(override) {
  if (override) return field(override);
  try {
    return field(await fs.readFile(path.join(PROJECT_ROOT, ".next", "BUILD_ID"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "unavailable", value: null, reason: ".next/BUILD_ID is missing" };
    throw error;
  }
}

function resolveSourceSha(override) {
  if (override) return field(override);
  try {
    return field(execFileSync("git", ["rev-parse", "HEAD"], { cwd: PROJECT_ROOT, encoding: "utf8" }));
  } catch {
    return { status: "unavailable", value: null, reason: "git HEAD could not be read" };
  }
}

async function collectDomEvidence(page, slug) {
  return page.evaluate(({ slug: areaSlug, sectionMarkers }) => {
    const normalized = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
    const fieldValue = (value) => normalized(value)
      ? { status: "available", value: normalized(value) }
      : { status: "missing", value: null };
    const schemas = [];
    const parseErrors = [];
    for (const [index, node] of [...document.querySelectorAll('script[type="application/ld+json"]')].entries()) {
      try {
        schemas.push(JSON.parse(node.textContent ?? ""));
      } catch (error) {
        parseErrors.push({ index, message: error instanceof Error ? error.message : String(error) });
      }
    }
    const nodes = [];
    const collect = (value) => {
      if (!value || typeof value !== "object") return;
      if (typeof value["@type"] === "string") nodes.push(value);
      for (const nested of Object.values(value)) collect(nested);
    };
    for (const schema of schemas) collect(schema);
    const typeCounts = {};
    for (const node of nodes) typeCounts[node["@type"]] = (typeCounts[node["@type"]] ?? 0) + 1;
    const itemLists = nodes.filter((node) => node["@type"] === "ItemList");
    const allShopCards = [...document.querySelectorAll('[data-area-shop-card="true"]')];
    const visibleShopCards = allShopCards.filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && !node.closest("[hidden]") && rect.width > 0 && rect.height > 0;
    });
    const sectionOrder = sectionMarkers
      .map(({ key, selector }) => ({ key, node: document.querySelector(selector) }))
      .filter(({ node }) => node)
      .sort((left, right) => {
        if (left.node === right.node) return 0;
        return left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      })
      .map(({ key }) => key);
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    return {
      slug: areaSlug,
      title: fieldValue(document.title),
      metaDescription: fieldValue(document.querySelector('meta[name="description"]')?.getAttribute("content")),
      h1: fieldValue(document.querySelector("h1")?.textContent),
      canonical: fieldValue(document.querySelector('link[rel="canonical"]')?.getAttribute("href")),
      robots: fieldValue(robots),
      noindex: /\bnoindex\b/iu.test(robots),
      shopCardCount: allShopCards.length,
      visibleShopCardCount: visibleShopCards.length,
      schema: {
        values: schemas,
        scriptCount: schemas.length + parseErrors.length,
        validScriptCount: schemas.length,
        invalidScriptCount: parseErrors.length,
        parseErrors,
        typeCounts: Object.fromEntries(Object.entries(typeCounts).sort(([left], [right]) => left.localeCompare(right))),
        breadcrumbListCount: typeCounts.BreadcrumbList ?? 0,
        faqPageCount: typeCounts.FAQPage ?? 0,
        reviewCount: typeCounts.Review ?? 0,
        ratingCount: typeCounts.Rating ?? 0,
        aggregateRatingCount: typeCounts.AggregateRating ?? 0,
        itemListCount: itemLists.length,
        itemLists: itemLists.map((itemList) => ({
          numberOfItems: Number.isFinite(itemList.numberOfItems) ? itemList.numberOfItems : null,
          itemListElementCount: Array.isArray(itemList.itemListElement) ? itemList.itemListElement.length : null,
        })),
      },
      ranking: {
        rankingSections: document.querySelectorAll("#ranking").length,
        rankingCards: document.querySelectorAll(".ranking-card").length,
        rankingPositionBadges: document.querySelectorAll('[class*="ranking-card--rank-"], .ranking-card__rank').length,
      },
      sectionOrder,
    };
  }, { slug, sectionMarkers: SECTION_MARKERS.map(({ key, selector }) => ({ key, selector })) });
}

async function collectScenario({ browser, fixture, javaScriptEnabled, width, baseUrl, timeoutMs, report }) {
  const height = viewportHeight(width);
  const jsState = javaScriptEnabled ? "enabled" : "disabled";
  const scenarioId = `${fixture.slug}-${width}x${height}-js-${jsState}`;
  const network = { blockedMutationCount: 0, blockedExternalNonAssetCount: 0, allowedExternalAssetCount: 0, events: [] };
  const context = await browser.newContext({
    javaScriptEnabled,
    viewport: { width, height },
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const decision = requestDecision({
      method: request.method(),
      resourceType: request.resourceType(),
      requestUrl: request.url(),
      baseOrigin: baseUrl,
    });
    if (decision.reason === "mutation") network.blockedMutationCount += 1;
    if (decision.reason === "external-non-asset") network.blockedExternalNonAssetCount += 1;
    if (decision.reason === "external-public-asset") network.allowedExternalAssetCount += 1;
    if (decision.reason !== "loopback-read" && network.events.length < 20) {
      let origin = "unparseable";
      try { origin = new URL(request.url()).origin; } catch {}
      network.events.push({ action: decision.action, reason: decision.reason, method: request.method(), resourceType: request.resourceType(), origin });
    }
    if (decision.action === "continue") await route.continue();
    else await route.abort("blockedbyclient");
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
  });
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));
  const row = {
    scenarioId,
    capturedAt: new Date().toISOString(),
    area: { slug: fixture.slug, label: fixture.label },
    viewport: { width, height },
    javaScript: jsState,
    route: `/area/${fixture.slug}/`,
    status: "pending",
    response: null,
    geometry: null,
    details: null,
    semantic: null,
    sectionOrderValidation: null,
    network,
    consoleErrorCount: 0,
    pageErrorCount: 0,
    error: null,
  };

  try {
    console.log(`${scenarioId}: navigation`);
    const response = await page.goto(`${baseUrl}/area/${fixture.slug}/`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (!response) throw new Error("navigation returned no HTTP response");
    const rawResponse = await fetch(response.url(), { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    assert.equal(rawResponse.status, 200, "same-run raw SSR GET");
    const rawHtml = await rawResponse.text();
    const responseHeaders = await response.allHeaders();
    row.response = {
      status: response.status(),
      finalUrl: response.url(),
      contentType: responseHeaders["content-type"] ?? null,
    };
    await page.locator("#area-final-title").waitFor({ state: "attached", timeout: timeoutMs });
    await page.evaluate(() => { const style = document.createElement("style"); style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}.hl-fade-in{opacity:1!important;transform:none!important}"; document.head.append(style); });
    console.log(`${scenarioId}: raw captured`);
    const firstShop = page.locator('[data-area-shop-card="true"]').first();
    const firstShopCount = await firstShop.count();
    if (firstShopCount > 0) await firstShop.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5_000) });
    const geometry = await page.evaluate(() => {
      const absoluteY = (node) => node ? node.getBoundingClientRect().top + window.scrollY : null;
      const visible = (node) => {
        if (!node) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && !node.closest("[hidden]") && rect.width > 0 && rect.height > 0;
      };
      const filterCandidates = [
        document.querySelector("#shop-list-filters"),
        document.querySelector(".area-shop-list-mobile-drawer"),
        document.querySelector("#shop-list-filters-mobile"),
      ];
      const filter = filterCandidates.find(visible) ?? null;
      const h1 = document.querySelector("#area-final-title");
      const firstCard = document.querySelector('[data-area-shop-card="true"]');
      const clientWidth = document.documentElement.clientWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const documentScrollWidth = document.documentElement.scrollWidth;
      return {
        h1Y: absoluteY(h1),
        filterY: absoluteY(filter),
        firstShopY: absoluteY(firstCard),
        bodyScrollWidth,
        documentScrollWidth,
        clientWidth,
        horizontalOverflowPixels: Math.max(0, bodyScrollWidth, documentScrollWidth) - clientWidth,
      };
    });
    row.geometry = {
      h1Y: numericField(geometry.h1Y),
      filterY: numericField(geometry.filterY),
      firstShopY: numericField(geometry.firstShopY),
      bodyScrollWidth: geometry.bodyScrollWidth,
      documentScrollWidth: geometry.documentScrollWidth,
      clientWidth: geometry.clientWidth,
      horizontalOverflowPixels: geometry.horizontalOverflowPixels,
    };

    console.log(`${scenarioId}: geometry captured`);
    const disclosure = page.locator('details[data-area-supporting-disclosure="true"]');
    const disclosureCount = await disclosure.count();
    const summary = disclosure.locator("summary");
    const supportingContent = disclosure.locator('[data-area-supporting-content="true"]');
    const initialOpen = disclosureCount === 1 ? await disclosure.evaluate((node) => node.open) : null;
    const summaryVisible = disclosureCount === 1 ? await summary.isVisible() : false;
    const keyboard = disclosureCount === 1
      ? { status: "pending", enterOpened: false, spaceClosed: false, supportingVisibleAfterOpen: false }
      : {
          status: fixture.details === "absent" ? "unavailable-expected-absent" : "unavailable-missing",
          enterOpened: null,
          spaceClosed: null,
          supportingVisibleAfterOpen: null,
        };
    if (disclosureCount === 1) {
      await summary.focus();
      await summary.press("Enter");
      keyboard.enterOpened = await disclosure.evaluate((node) => node.open);
      keyboard.supportingVisibleAfterOpen = await supportingContent.count() === 1 && await supportingContent.isVisible();
      await summary.press("Space");
      keyboard.spaceClosed = !(await disclosure.evaluate((node) => node.open));
      keyboard.focusRetained = await summary.evaluate((node) => document.activeElement === node);
      await summary.click();
      keyboard.pointerOpened = await disclosure.evaluate((node) => node.open);
      await summary.click();
      keyboard.pointerClosed = !(await disclosure.evaluate((node) => node.open));
      keyboard.status = keyboard.enterOpened && keyboard.spaceClosed && keyboard.supportingVisibleAfterOpen && keyboard.focusRetained && keyboard.pointerOpened && keyboard.pointerClosed
        ? "verified"
        : "regression";
    }
    row.details = {
      expected: fixture.details,
      count: disclosureCount,
      initialOpen,
      initialState: disclosureCount === 0 ? "missing" : disclosureCount > 1 ? "unexpected-multiple" : initialOpen ? "open" : "closed",
      summaryVisible,
      keyboard,
      noJsSupportingAccess: javaScriptEnabled
        ? { status: "not-applicable" }
        : disclosureCount === 1
          ? {
              status: summaryVisible && keyboard.supportingVisibleAfterOpen ? "verified" : "regression",
              summaryVisible,
              supportingVisibleAfterOpen: keyboard.supportingVisibleAfterOpen,
            }
          : { status: fixture.details === "absent" ? "unavailable-expected-absent" : "unavailable-missing" },
    };

    console.log(`${scenarioId}: details checked`);
    const initialHtml = rawSemanticEvidence(rawHtml, fixture.slug, responseHeaders);
    const finalDom = await collectDomEvidence(page, fixture.slug);
    row.semantic = { initialHtml, finalDom };
    row.sectionOrderValidation = {
      initialHtml: validateSectionOrder(initialHtml.sectionOrder),
      finalDom: validateSectionOrder(finalDom.sectionOrder),
    };
    row.consoleErrorCount = consoleErrors.length;
    row.pageErrorCount = pageErrors.length;

    pushAssertion(report, response.status() === 200, "HTTP status must be 200", scenarioId, { status: response.status() });
    pushAssertion(report, geometry.horizontalOverflowPixels <= 1, "horizontal overflow must be at most 1px", scenarioId, geometry);
    pushAssertion(report, finalDom.h1.status === "available", "H1 must exist", scenarioId);
    pushAssertion(report, geometry.filterY !== null, "filter start Y must be measurable", scenarioId);
    pushAssertion(report, geometry.firstShopY !== null, "first shop Y must be measurable", scenarioId);
    pushAssertion(report, finalDom.schema.invalidScriptCount === 0, "DOM JSON-LD must parse", scenarioId, finalDom.schema.parseErrors);
    pushAssertion(report, initialHtml.schema.invalidScriptCount === 0, "initial HTML JSON-LD must parse", scenarioId, initialHtml.schema.parseErrors);
    pushAssertion(report, !initialHtml.noindex && !finalDom.noindex, "Area page must remain indexable", scenarioId);
    pushAssertion(report, initialHtml.ranking.rankingSections === 0 && initialHtml.ranking.rankingCards === 0 && initialHtml.ranking.rankingPositionBadges === 0, "fake ranking UI must remain absent", scenarioId, initialHtml.ranking);
    pushAssertion(report, row.sectionOrderValidation.initialHtml.status === "verified", "initial HTML section order must remain valid", scenarioId, row.sectionOrderValidation.initialHtml);
    pushAssertion(report, row.sectionOrderValidation.finalDom.status === "verified", "final DOM section order must remain valid", scenarioId, row.sectionOrderValidation.finalDom);
    if (fixture.details === "present") {
      pushAssertion(report, disclosureCount === 1, "pilot supporting details must exist exactly once", scenarioId, { disclosureCount });
      pushAssertion(report, initialOpen === false, "pilot supporting details must be closed initially", scenarioId, { initialOpen });
      pushAssertion(report, initialHtml.details.present && initialHtml.details.complete, "pilot details must exist completely in initial HTML", scenarioId, initialHtml.details);
      pushAssertion(report, initialHtml.details.initiallyOpen === false, "pilot initial HTML details must omit open state", scenarioId, initialHtml.details);
      pushAssertion(report, !initialHtml.details.insideHiddenPprSegment, "pilot details must not depend on a hidden PPR segment", scenarioId, initialHtml.details);
      pushAssertion(report, keyboard.status === "verified", "pilot details keyboard toggling must work", scenarioId, keyboard);
      if (!javaScriptEnabled) {
        pushAssertion(report, row.details.noJsSupportingAccess.status === "verified", "pilot supporting information must be accessible without JavaScript", scenarioId, row.details.noJsSupportingAccess);
      }
      pushAssertion(report, initialHtml.schema.itemListCount === 1, "pilot initial HTML must contain one ItemList", scenarioId, initialHtml.schema);
      pushAssertion(report, finalDom.schema.itemListCount === 1, "pilot DOM must contain one ItemList", scenarioId, finalDom.schema);
      pushAssertion(report, initialHtml.schema.itemLists[0]?.numberOfItems === fixture.expectedItemListCount, `pilot initial HTML ItemList numberOfItems must be ${fixture.expectedItemListCount}`, scenarioId, initialHtml.schema.itemLists);
      pushAssertion(report, initialHtml.schema.itemLists[0]?.itemListElementCount === fixture.expectedItemListCount, `pilot initial HTML ItemList elements must be ${fixture.expectedItemListCount}`, scenarioId, initialHtml.schema.itemLists);
      pushAssertion(report, finalDom.schema.itemLists[0]?.numberOfItems === fixture.expectedItemListCount, `pilot DOM ItemList numberOfItems must be ${fixture.expectedItemListCount}`, scenarioId, finalDom.schema.itemLists);
      pushAssertion(report, finalDom.schema.itemLists[0]?.itemListElementCount === fixture.expectedItemListCount, `pilot DOM ItemList elements must be ${fixture.expectedItemListCount}`, scenarioId, finalDom.schema.itemLists);
    } else {
      pushAssertion(report, disclosureCount === 0, "non-pilot supporting details must match the current absent state", scenarioId, { disclosureCount });
      pushAssertion(report, !initialHtml.details.present, "non-pilot initial HTML supporting details must match the current absent state", scenarioId, initialHtml.details);
    }
    for (const key of ["title", "metaDescription", "h1", "canonical", "robots", "noindex"]) {
      assert.deepEqual(finalDom[key], initialHtml[key], `${scenarioId}: SSR/DOM ${key}`);
    }
    assert.deepEqual(finalDom.schema.values, initialHtml.schema.values, `${scenarioId}: full schema SSR/DOM identity/order`);
    assert.equal(finalDom.shopCardCount, initialHtml.shopCardCount, `${scenarioId}: SSR/DOM cards`);
    assert.equal(finalDom.schema.reviewCount + finalDom.schema.ratingCount + finalDom.schema.aggregateRatingCount, 0, "no fabricated rating schema");
    const beforeDir = process.env.AREA_V2_BASELINE_BEFORE_DIR;
    assert.ok(beforeDir, "pre-change five-Area HTML baseline is required");
    const beforeHtml = await fs.readFile(path.join(beforeDir, `${fixture.slug}.html`), "utf8");
    const beforeHttp = JSON.parse(await fs.readFile(path.join(beforeDir, `${fixture.slug}.json`), "utf8"));
    const before = rawSemanticEvidence(beforeHtml, fixture.slug, Object.fromEntries(Object.entries(beforeHttp.headers).map(([key, value]) => [key.toLowerCase(), value])));
    for (const key of ["title", "metaDescription", "h1", "canonical", "robots", "xRobotsTag", "noindex", "shopCardCount"]) {
      assert.deepEqual(initialHtml[key], before[key], `${scenarioId}: five-Area before/after ${key}`);
    }
    assert.deepEqual(initialHtml.schema.values, before.schema.values, `${scenarioId}: five-Area complete schema before/after`);
    assert.deepEqual(initialHtml.sectionOrder, before.sectionOrder, `${scenarioId}: section order before/after`);
    if (fixture.details === "present") {
      const hotfix = JSON.parse(await fs.readFile(process.env.AREA_V2_HOTFIX_SUCCESS_REPORT, "utf8"));
      const prior = hotfix.measurements.find((item) => item.slug === fixture.slug && item.width === width);
      assert.ok(prior, "successful Hotfix width baseline required");
      assert.ok(geometry.firstShopY <= prior.firstShopY + 1, `${scenarioId}: first shop must not move down beyond 1px rounding`);
      row.hotfixFirstShopY = prior.firstShopY;
    }
    const sourceShops = extractShopViews(rawHtml);
    const links = page.locator('[data-area-shop-card="true"] a[href*="/shops/"]');
    const shopHref = await links.first().getAttribute("href");
    assert.ok(shopHref, "shop link exists");
    const shopUrl = new URL(shopHref, baseUrl);
    assert.equal(shopUrl.pathname.startsWith("/shops/"), true);
    const shopResponse = await context.request.get(new URL(shopUrl.pathname, baseUrl).href);
    assert.equal(shopResponse.status(), 200, "local shop link GET must resolve");
    row.interactions = { shopHref, shopHttp: shopResponse.status(), filters: "no-JS static list", sort: "no-JS static list" };
    const anchor = page.locator('a[href="#shop-list"]:visible').first();
    assert.ok(await anchor.count(), "visible list anchor exists");
    await anchor.click();
    await page.waitForFunction(() => location.hash === "#shop-list", { timeout: 10_000 });
    assert.equal(new URL(page.url()).hash, "#shop-list", "pointer list anchor");
    row.interactions.anchor = "PASS";
    if (javaScriptEnabled) {
      const drawer = page.locator('.area-shop-list-mobile-drawer');
      if (await drawer.isVisible() && !(await drawer.evaluate((node) => node.open))) await drawer.locator('summary').click();
      const lateFilter = page.getByRole('button', { name: '深夜営業', exact: true }).filter({ visible: true }).first();
      await lateFilter.click();
      await page.waitForFunction(() => new URLSearchParams(location.search).get('filters')?.includes('late-night'));
      assert.equal(await lateFilter.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-area-shop-card="true"]').count(), currentSourceFacts(sourceShops).lateNight, "filter results match source predicate");
      await lateFilter.focus();
      await lateFilter.press('Space');
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('filters'));
      assert.equal(await page.locator('[data-area-shop-card="true"]').count(), sourceShops.length, "keyboard clear restores all cards");
      const priceSort = page.getByRole('button', { name: '料金が安い順', exact: true }).filter({ visible: true }).first();
      await priceSort.click();
      await page.waitForFunction(() => new URLSearchParams(location.search).get('sort') === 'price-asc');
      assert.equal(await priceSort.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-area-shop-card="true"]').count(), sourceShops.length, "sort retains cards");
      const prices = currentSourcePrices(sourceShops);
      const priceBySlug = new Map(sourceShops.map((shop, index) => [decodeURIComponent(shop.slug), prices[index]]));
      const sortedSlugs = await page.locator('[data-area-shop-card="true"]').evaluateAll((cards) => cards.map((card) => decodeURIComponent(new URL(card.querySelector('a[href*="/shops/"]').href).pathname.split('/').filter(Boolean).at(-1))));
      const sortedPrices = sortedSlugs.map((slug) => { assert.ok(priceBySlug.has(slug)); return priceBySlug.get(slug) ?? Infinity; });
      for (let index = 1; index < sortedPrices.length; index += 1) assert.ok(sortedPrices[index - 1] <= sortedPrices[index], "actual card price order ascending; unknown last");
      row.interactions.filters = "PASS pointer apply / keyboard clear / source count";
      row.interactions.sort = "PASS price-asc URL/state/count/actual-price-order";
    }
    row.status = report.failures.some((failure) => failure.scenarioId === scenarioId) ? "regression" : "captured";
  } catch (error) {
    row.status = "capture-error";
    row.error = error instanceof Error ? error.message : String(error);
    report.failures.push({ label: "scenario capture must complete", scenarioId, details: { message: row.error } });
  } finally {
    row.consoleErrorCount = consoleErrors.length;
    row.pageErrorCount = pageErrors.length;
    await context.close();
  }
  return row;
}

async function runSelfTest() {
  assert.equal(requireLoopbackBaseUrl("http://127.0.0.1:3147"), "http://127.0.0.1:3147");
  assert.equal(requireLoopbackBaseUrl("http://localhost:3000"), "http://localhost:3000");
  assert.equal(requireLoopbackBaseUrl("http://[::1]:3000"), "http://[::1]:3000");
  assert.throws(() => requireLoopbackBaseUrl("https://mens-esthe-kuchikomi.com"), /loopback/iu);
  assert.throws(() => requireLoopbackBaseUrl("https://example.vercel.app"), /loopback/iu);
  assert.throws(() => requireLoopbackBaseUrl("http://127.0.0.1:3000/area/shinosaka/"), /path/iu);
  assert.throws(() => requireLoopbackBaseUrl("http://user:password@127.0.0.1:3000"), /userinfo/iu);
  assert.deepEqual(
    requestDecision({ method: "GET", resourceType: "document", requestUrl: "http://127.0.0.1:3147/area/shinosaka/", baseOrigin: "http://127.0.0.1:3147" }),
    { action: "continue", reason: "loopback-read" },
  );
  assert.deepEqual(
    requestDecision({ method: "POST", resourceType: "fetch", requestUrl: "http://127.0.0.1:3147/api/write", baseOrigin: "http://127.0.0.1:3147" }),
    { action: "abort", reason: "mutation" },
  );
  assert.deepEqual(
    requestDecision({ method: "GET", resourceType: "script", requestUrl: "https://www.googletagmanager.com/gtag/js", baseOrigin: "http://127.0.0.1:3147" }),
    { action: "abort", reason: "external-non-asset" },
  );
  assert.deepEqual(
    requestDecision({ method: "GET", resourceType: "image", requestUrl: "https://cdn.example.test/shop.jpg", baseOrigin: "http://127.0.0.1:3147" }),
    { action: "continue", reason: "external-public-asset" },
  );
  const syntheticHtml = `<!doctype html><html><head><title>Area title</title><meta name="description" content="Description"><meta name="robots" content="index,follow"><link rel="canonical" href="https://example.test/area/sample/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","numberOfItems":2,"itemListElement":[{},{}]}</script></head><body><h1 id="area-final-title">Area H1</h1><details data-area-supporting-disclosure="true"><summary>More</summary><div data-area-supporting-content="true"><section data-area-depth="coverage">Facts</section><section id="area-decision-guide">Guide</section></div></details><section id="shop-list"><article data-area-shop-card="true"></article></section><div id="compare-tabs"></div><section id="faq"></section><section id="related-areas"></section></body></html>`;
  const semantic = rawSemanticEvidence(syntheticHtml, "sample");
  assert.equal(semantic.schema.itemListCount, 1);
  assert.equal(semantic.schema.itemLists[0].numberOfItems, 2);
  assert.equal(semantic.shopCardCount, 1);
  assert.equal(semantic.details.present, true);
  assert.equal(semantic.details.initiallyOpen, false);
  assert.equal(validateSectionOrder(semantic.sectionOrder).status, "verified");
  console.log("Area Template V2 browser baseline self-test passed");
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args["self-test"]) {
    await runSelfTest();
    return;
  }
  const baseUrl = requireLoopbackBaseUrl(
    args["base-url"] ?? process.env.AREA_V2_BASELINE_BASE_URL ?? DEFAULT_BASE_URL,
  );
  const reportPath = path.resolve(
    args["report-path"] ?? process.env.AREA_V2_BASELINE_REPORT_PATH ?? DEFAULT_REPORT_PATH,
  );
  const timeoutMs = timeoutValue(args["timeout-ms"] ?? process.env.AREA_V2_BASELINE_TIMEOUT_MS);
  const sourceSha = resolveSourceSha(args["source-sha"] ?? process.env.AREA_V2_BASELINE_SOURCE_SHA);
  const buildId = await readBuildId(args["build-id"] ?? process.env.AREA_V2_BASELINE_BUILD_ID);
  const startedAt = new Date().toISOString();
  const report = {
    schemaVersion: 1,
    taskId: "AREA-TEMPLATE-V2-FOUNDATION-01A-CONTRACT-LOCK",
    baselineKind: "local-loopback",
    contractBaseSha: CONTRACT_BASE_SHA,
    sourceSha,
    buildId,
    baseUrl,
    startedAt,
    completedAt: null,
    dimensions: {
      areaSlugs: AREAS.map(({ slug }) => slug),
      widths: WIDTHS,
      heights: { mobile: 844, desktop: 900 },
      javaScriptStates: ["enabled", "disabled"],
      expectedScenarioCount: AREAS.length * WIDTHS.length * 2,
    },
    requestPolicy: {
      loopbackNavigationOnly: true,
      methodsAllowed: ["GET"],
      externalPublicAssetResourceTypesAllowed: [...PUBLIC_ASSET_RESOURCE_TYPES].sort(),
      externalTelemetryBlocked: true,
    },
    assertionCount: 0,
    scenarios: [],
    failures: [],
    summary: null,
  };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const fixture of AREAS) {
      for (const javaScriptEnabled of [true, false]) {
        for (const width of WIDTHS) {
          report.scenarios.push(await collectScenario({
            browser,
            fixture,
            javaScriptEnabled,
            width,
            baseUrl,
            timeoutMs,
            report,
          }));
          console.log(`${fixture.slug} ${width}px ${javaScriptEnabled ? "JS" : "noJS"}: ${report.scenarios.at(-1).status} ${report.scenarios.at(-1).error ?? ""}`);
          await fs.mkdir(path.dirname(reportPath), { recursive: true });
          await fs.writeFile(`${reportPath}.progress.json`, JSON.stringify(report, null, 2));
        }
      }
    }
  } finally {
    await browser.close();
  }
  report.completedAt = new Date().toISOString();
  report.summary = {
    expectedScenarioCount: report.dimensions.expectedScenarioCount,
    capturedScenarioCount: report.scenarios.filter(({ status }) => status === "captured").length,
    regressionScenarioCount: report.scenarios.filter(({ status }) => status === "regression").length,
    captureErrorScenarioCount: report.scenarios.filter(({ status }) => status === "capture-error").length,
    failureCount: report.failures.length,
  };
  if (report.scenarios.length !== report.dimensions.expectedScenarioCount) {
    report.failures.push({
      label: "all expected scenarios must be represented",
      scenarioId: null,
      details: { expected: report.dimensions.expectedScenarioCount, actual: report.scenarios.length },
    });
    report.summary.failureCount = report.failures.length;
  }
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    reportPath,
    sourceSha,
    buildId,
    ...report.summary,
  }, null, 2));
  if (report.failures.length > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(`Area Template V2 browser baseline failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
