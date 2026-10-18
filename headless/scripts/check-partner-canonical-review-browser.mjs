import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const screenshotDir = process.env.PARTNER_CANONICAL_REVIEW_QA_SCREENSHOT_DIR;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
const managedShopId = "33333333-3333-4333-8333-333333333333";
const appShopId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const revision = 7;
const reviewRequests = [];

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function stop(child) {
  if (child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise((resolve) => child.once("exit", resolve));
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport, `${label} must not overflow horizontally: ${JSON.stringify(dimensions)}`);
}

const mockPort = await freePort();
const appPort = await freePort();
const mock = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${mockPort}`);
  let body = {};
  for await (const chunk of request) body = JSON.parse(String(chunk));
  if (url.pathname === "/rest/v1/rpc/get_operator_managed_shop_detail" && request.method === "POST") {
    return json(response, 200, {
      shop: { id: managedShopId, app_shop_id: appShopId, shop_slug: "fixture-partner-store", publication_state: "published" },
      current_revision: { revision, state: "submitted", shop_name: "Fixture partner store", area_slug: "fixture-area", area_name: "Fixture area", official_url: null, introduction: "Partner submitted fixture", address: null, business_hours: null, phone: null, line_url: null, booking_url: null, basic_price: null, price_90: null, banner_asset_id: null, gallery_asset_ids: [] },
    });
  }
  if (url.pathname === "/rest/v1/rpc/review_canonical_managed_shop_revision" && request.method === "POST") {
    reviewRequests.push(body);
    await new Promise((resolve) => setTimeout(resolve, 150));
    return json(response, 200, "ok");
  }
  return json(response, 404, { message: "not found" });
});
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const baseUrl = `http://127.0.0.1:${appPort}`;
const next = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, SHOP_DIRECTORY_SOURCE: "supabase", SUPABASE_URL: `http://127.0.0.1:${mockPort}`, SUPABASE_AUTH_PUBLISHABLE_KEY: "fixture-publishable-key", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key", DASHBOARD_BASIC_AUTH_USER: "operator", DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password" },
});
let log = "";
next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4_000); });
next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4_000); });

const browser = await chromium.launch({ headless: true, ...(process.env.ESKOMI_E2E_CHROMIUM ? { executablePath: process.env.ESKOMI_E2E_CHROMIUM } : {}) });
try {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Canonical review QA server exited before ready\n${log}`);
    try { if ((await fetch(`${baseUrl}/dashboard/shops/managed/${managedShopId}/`)).status === 401) break; } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials: { username: "operator", password: "fixture-password" } });
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}/dashboard/shops/managed/${managedShopId}/`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.getByText("店舗からの申請を確認し、承認または差し戻しを選択してください。").waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(page, "1280px canonical approval");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "承認して公開" }).click();
  await page.waitForTimeout(200);
  assert.equal(reviewRequests.length, 0, "cancelling an approval note must not create a review request");

  page.once("dialog", (dialog) => dialog.accept(""));
  const [approval] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/dashboard/managed-shops/") && candidate.request().method() === "POST"),
    page.getByRole("button", { name: "承認して公開" }).click(),
  ]);
  await page.getByRole("button", { name: "承認して公開" }).evaluate((button) => button.click());
  assert.equal(approval.status(), 200, await approval.text());
  await page.getByRole("status").getByText("申請を承認して公開しました").waitFor({ state: "visible" });
  assert.equal(reviewRequests.length, 1, "an in-flight approval must ignore a repeat click");
  assert.deepEqual(reviewRequests[0], { p_managed_shop_id: managedShopId, p_expected_revision: revision, p_decision: "approved", p_reviewer_label: "dashboard-operator", p_note: "" });

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "差し戻し" }).click();
  await page.waitForTimeout(200);
  assert.equal(reviewRequests.length, 1, "cancelling a changes-requested note must not create a review request");

  page.once("dialog", (dialog) => dialog.accept("   "));
  await page.getByRole("button", { name: "差し戻し" }).click();
  await page.getByRole("status").getByText("差し戻し理由を入力してください。").waitFor({ state: "visible" });
  assert.equal(reviewRequests.length, 1, "an empty changes-requested note must not create a review request");

  page.once("dialog", (dialog) => dialog.accept("fixture correction reason"));
  const [changesRequested] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/dashboard/managed-shops/") && candidate.request().method() === "POST"),
    page.getByRole("button", { name: "差し戻し" }).click(),
  ]);
  await page.getByRole("button", { name: "差し戻し" }).evaluate((button) => button.click());
  assert.equal(changesRequested.status(), 200, await changesRequested.text());
  await page.getByRole("status").getByText("申請を差し戻しました").waitFor({ state: "visible" });
  assert.equal(reviewRequests.length, 2, "an in-flight changes-requested action must ignore a repeat click");
  assert.deepEqual(reviewRequests[1], { p_managed_shop_id: managedShopId, p_expected_revision: revision, p_decision: "changes_requested", p_reviewer_label: "dashboard-operator", p_note: "fixture correction reason" });
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/partner-canonical-approval-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "390px canonical approval");
  if (screenshotDir) {
    await page.screenshot({ path: `${screenshotDir}/partner-canonical-approval-390.png`, fullPage: true });
    await page.screenshot({ path: `${screenshotDir}/partner-canonical-approval-390-viewport.png` });
  }
  await context.close();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, httpCredentials: { username: "operator", password: "fixture-password" } });
  const mobile = await mobileContext.newPage();
  assert.equal((await mobile.goto(`${baseUrl}/dashboard/shops/managed/${managedShopId}/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
  await mobile.getByText("店舗からの申請を確認し、承認または差し戻しを選択してください。").waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(mobile, "390px independent canonical review");
  mobile.once("dialog", (dialog) => dialog.accept("mobile approval"));
  const [mobileApproval] = await Promise.all([
    mobile.waitForResponse((candidate) => candidate.url().endsWith("/api/dashboard/managed-shops/") && candidate.request().method() === "POST"),
    mobile.getByRole("button", { name: "承認して公開" }).click(),
  ]);
  assert.equal(mobileApproval.status(), 200, await mobileApproval.text());
  await mobile.getByRole("status").getByText("申請を承認して公開しました").waitFor({ state: "visible" });
  mobile.once("dialog", (dialog) => dialog.accept("mobile correction reason"));
  const [mobileChangesRequested] = await Promise.all([
    mobile.waitForResponse((candidate) => candidate.url().endsWith("/api/dashboard/managed-shops/") && candidate.request().method() === "POST"),
    mobile.getByRole("button", { name: "差し戻し" }).click(),
  ]);
  assert.equal(mobileChangesRequested.status(), 200, await mobileChangesRequested.text());
  await mobile.getByRole("status").getByText("申請を差し戻しました").waitFor({ state: "visible" });
  assert.equal(reviewRequests.length, 4, "PC and SP must each execute approval and changes-requested actions exactly once");
  assert.deepEqual(reviewRequests[2], { p_managed_shop_id: managedShopId, p_expected_revision: revision, p_decision: "approved", p_reviewer_label: "dashboard-operator", p_note: "mobile approval" });
  assert.deepEqual(reviewRequests[3], { p_managed_shop_id: managedShopId, p_expected_revision: revision, p_decision: "changes_requested", p_reviewer_label: "dashboard-operator", p_note: "mobile correction reason" });
  if (screenshotDir) await mobile.screenshot({ path: `${screenshotDir}/partner-canonical-changes-requested-390.png`, fullPage: true });
  await mobileContext.close();
  console.log("partner canonical approval browser QA: PASS");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
