import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.LISTING_QA_BASE_URL ?? "http://127.0.0.1:3105";
const route = process.env.LISTING_QA_ROUTE;
const output = process.env.LISTING_QA_OUTPUT;
const expected = process.env.LISTING_QA_EXPECT;
const scrollToText = process.env.LISTING_QA_SCROLL_TO_TEXT;
const width = Number(process.env.LISTING_QA_WIDTH ?? 1440);
const height = Number(process.env.LISTING_QA_HEIGHT ?? 1000);

assert.ok(route && route.startsWith("/"), "LISTING_QA_ROUTE is required");
assert.ok(output, "LISTING_QA_OUTPUT is required");

const browser = await chromium.connectOverCDP("http://127.0.0.1:9322");
const operatorAuth = process.env.LISTING_QA_OPERATOR_AUTH === "1";
const context = await browser.newContext({
  viewport: { width, height },
  ...(operatorAuth ? { httpCredentials: { username: "operator", password: "fixture-password" }, extraHTTPHeaders: { Authorization: `Basic ${Buffer.from("operator:fixture-password").toString("base64")}` } } : {}),
});
try {
  const page = await context.newPage();
  page.on("response", (response) => {
    if (response.url().includes("/api/dashboard/listing-applications")) console.log(`dashboard API ${response.status()}`);
  });
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  if (expected) await page.getByText(expected, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
  else await page.waitForTimeout(1_000);
  if (scrollToText) await page.getByText(scrollToText, { exact: false }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: output, fullPage: false });
  console.log(`captured ${route}`);
} finally {
  await context.close();
}
