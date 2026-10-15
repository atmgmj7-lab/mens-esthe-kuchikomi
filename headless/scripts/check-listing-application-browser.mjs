import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.LISTING_QA_BASE_URL ?? "http://127.0.0.1:3105";
const executablePath = "/Users/narikiyo/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLUKgAAAABJRU5ErkJggg==", "base64");
const screenshotDir = process.env.LISTING_QA_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
// Viewport captures keep this full end-to-end test fast while still preserving the
// exact desktop/mobile/operator/public states for visual review.
const screenshot = async (page, name) => { if (screenshotDir) await page.screenshot({ path: join(screenshotDir, name), fullPage: false }); };
const fillRequired = async (page, prefix) => {
  await page.locator('input[name="shopName"]').fill(`${prefix}店舗`);
  await page.locator('input[name="area"]').fill("大阪市中央区");
  await page.locator('input[name="websiteUrl"]').fill("https://example.test/listing-qa");
  await page.locator('input[name="contactName"]').fill("ローカル確認担当");
  await page.locator('input[name="contactEmail"]').fill(`${prefix}@example.test`);
  await page.locator('select[name="contactRole"]').selectOption("owner");
  for (const name of ["consentPrivacy", "consentAccuracy", "consentImageRights"]) await page.locator(`input[name="${name}"]`).check();
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
  await page.goto(`${base}/storelisting/`, { waitUntil: "domcontentloaded" });
  if (process.env.LISTING_QA_SCREENSHOT) await page.screenshot({ path: process.env.LISTING_QA_SCREENSHOT, fullPage: false });
  await screenshot(page, "listing-application-pc.png");
  console.log("browser QA: applicant desktop captured");
  await expectText(page, "Eskomi紹介バナー");
  assert.equal(await page.locator('.hl-listing-banner-tool__choices button').count(), 3, "three official banner choices must render");
  await page.getByRole("radio", { name: /200 × 40/ }).click(); await page.waitForFunction(() => document.querySelector('.hl-listing-banner-tool__preview img')?.getAttribute("width") === "200");
  assert.equal(await page.locator('.hl-listing-banner-tool__preview img').getAttribute("width"), "200", "banner preview must follow selected size");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "desktop must not overflow horizontally");
  let applicationId = "";
  page.on("response", async (response) => { if (response.url().endsWith("/api/listing-applications/") && response.request().method() === "POST") { const body = await response.json().catch(() => null); if (body?.applicationId) applicationId = body.applicationId; } });
  await fillRequired(page, "listing-browser-qa");
  await page.locator('input[name="banner"]').setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "申請内容を送信する" }).click();
  await expectText(page, "申請を受け付けました");
  console.log("browser QA: applicant submission completed");
  assert.match(applicationId, /^[0-9a-f-]{36}$/i, "submission must yield an application id only to the in-page flow");
  const publicBefore = await page.request.get(`${base}/api/listing-applications/public/${applicationId}/`); assert.equal(publicBefore.status(), 404, "unapproved application must not be public");
  const operator = await browser.newContext({ httpCredentials: { username: "operator", password: "fixture-password" }, extraHTTPHeaders: { Authorization: `Basic ${Buffer.from("operator:fixture-password").toString("base64")}` }, viewport: { width: 1280, height: 900 } }); const operatorPage = await operator.newPage();
  await operatorPage.goto(`${base}/dashboard/listing-applications/${applicationId}/`, { waitUntil: "domcontentloaded" }); await expectText(operatorPage, "ローカル確認担当");
  await operatorPage.locator('input[name="shopName"]').fill("listing-browser-qa編集店舗");
  await operatorPage.locator('textarea[name="introduction"]').fill("ローカル画面確認用に運営が編集した紹介文です。");
  await operatorPage.getByRole("button", { name: "確認待ちとして保存" }).click(); await expectText(operatorPage, "確認待ちの編集内容を保存しました");
  await screenshot(operatorPage, "listing-application-operator-diff.png");
  console.log("browser QA: operator diff captured");
  operatorPage.on("dialog", (dialog) => dialog.accept("local browser QA"));
  await operatorPage.getByRole("button", { name: "承認して公開候補にする" }).click(); await expectText(operatorPage, "承認しました");
  const publicPage = await context.newPage(); await publicPage.goto(`${base}/listing/${applicationId}/`, { waitUntil: "domcontentloaded" }); await expectText(publicPage, "listing-browser-qa編集店舗"); assert.equal(await publicPage.locator('img[alt*="店舗バナー"]').count(), 1, "approved banner must render through the public-safe proxy"); await screenshot(publicPage, "listing-application-approved-public.png");
  console.log("browser QA: public listing captured");
  const publicJson = await (await page.request.get(`${base}/api/listing-applications/public/${applicationId}/`)).text(); assert.doesNotMatch(publicJson, /ローカル確認担当|listing-browser-qa@example\.test|contact_/i, "public endpoint must not expose contact data");
  const mobile = await browser.newContext({ viewport: { width: 320, height: 720 } }); const mobilePage = await mobile.newPage(); await mobilePage.goto(`${base}/storelisting/`, { waitUntil: "domcontentloaded" }); await expectText(mobilePage, "Eskomi紹介バナー"); assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "mobile must not overflow horizontally"); await screenshot(mobilePage, "listing-application-sp.png");
  console.log("browser QA: applicant mobile captured");
  await mobilePage.locator('input[name="shopName"]').fill("無効画像店舗"); await mobilePage.locator('input[name="area"]').fill("大阪市"); await mobilePage.locator('input[name="websiteUrl"]').fill("https://example.test/invalid"); await mobilePage.locator('input[name="contactName"]').fill("非公開確認者"); await mobilePage.locator('input[name="contactEmail"]').fill("invalid-image@example.test"); await mobilePage.locator('select[name="contactRole"]').selectOption("owner"); for (const name of ["consentPrivacy", "consentAccuracy", "consentImageRights"]) await mobilePage.locator(`input[name="${name}"]`).check(); await mobilePage.locator('input[name="banner"]').setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not an image") }); await mobilePage.getByRole("button", { name: "申請内容を送信する" }).click(); await expectText(mobilePage, "PNG・JPEG・WebPの実画像"); assert.equal(await mobilePage.getByText("申請を受け付けました").count(), 0, "asset failure must never show complete success");
  const existing = await browser.newContext({ viewport: { width: 390, height: 844 } }); const existingPage = await existing.newPage(); await existingPage.goto(`${base}/storelisting/?shop_id=768&shop_slug=local-existing&shop_name=%E6%8E%B2%E8%BC%89%E6%B8%88%E3%81%BF%E5%BA%97%E8%88%97&target_url=https%3A%2F%2Fmens-esthe-kuchikomi.com%2Fshops%2Flocal-existing%2F&source=shop-detail`, { waitUntil: "domcontentloaded" }); await expectText(existingPage, "対象店舗（確認用）"); assert.equal(await existingPage.getByRole("radio", { name: /掲載中の情報を修正する/ }).isChecked(), true, "canonical existing shop link must select the change flow");
  await Promise.all([context.close(), operator.close(), mobile.close(), existing.close()]);
  console.log("listing application browser QA: PASS");
} finally { await browser.close(); }

async function expectText(page, value) { await page.getByText(value, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 }); }
