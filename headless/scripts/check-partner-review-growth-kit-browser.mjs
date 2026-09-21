import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tokenQr = "33333333-3333-4333-8333-333333333333";
const tokenLine = "44444444-4444-4444-8444-444444444444";
const tokenWebsite = "55555555-5555-4555-8555-555555555555";

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
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

const mockPort = await freePort();
const appPort = await freePort();
const metricWorkspaceRequests = [];
const mock = http.createServer(async (request, response) => {
  if (request.url === "/auth/v1/user" && request.method === "GET") {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    return token === "partner-a-session-token"
      ? json(response, 200, { id: userA, email: "a@example.invalid" })
      : json(response, 401, { message: "invalid" });
  }
  if (request.url === "/rest/v1/rpc/get_partner_auth_membership" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    return json(response, 200, JSON.parse(body).p_auth_user_id === userA ? [{
      workspace_id: workspaceA, wp_shop_id: 101, shop_slug: "shop-a", role: "owner",
    }] : []);
  }
  if (request.url === "/rest/v1/rpc/get_partner_workspace_identity" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    return json(response, 200, JSON.parse(body).p_workspace_id === workspaceA ? [{
      workspace_id: workspaceA, wp_shop_id: 101, shop_slug: "shop-a", shop_name: "Partner Shop A",
      canonical_url: "https://mens-esthe-kuchikomi.com/shops/shop-a/", state: "free_official_partner",
    }] : []);
  }
  if (request.url === "/rest/v1/rpc/get_partner_review_growth_metrics" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const workspaceId = JSON.parse(body).p_workspace_id;
    metricWorkspaceRequests.push(workspaceId);
    return json(response, 200, workspaceId === workspaceA ? [{
      workspace_id: workspaceA,
      wp_shop_id: 101,
      submitted_reviews: 8,
      pending_reviews: 2,
      public_reviews: 5,
      campaigns: [
        { id: "77777777-7777-4777-8777-777777777777", channel: "counter_qr", token: tokenQr, isActive: true, openCount: 12, startCount: 8, conversionCount: 4 },
        { id: "88888888-8888-4888-8888-888888888888", channel: "line_after_visit", token: tokenLine, isActive: true, openCount: 9, startCount: 7, conversionCount: 3 },
        { id: "99999999-9999-4999-8999-999999999999", channel: "shop_website", token: tokenWebsite, isActive: true, openCount: 6, startCount: 4, conversionCount: 2 },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", channel: "eskomi_shop_page", token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", isActive: true, openCount: 5, startCount: 3, conversionCount: 1 },
      ],
    }] : []);
  }
  return json(response, 404, { message: "not found" });
});
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const baseUrl = `http://127.0.0.1:${appPort}`;
const next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    SUPABASE_AUTH_PUBLISHABLE_KEY: "fixture-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key",
    PARTNER_AUTH_REDIRECT_ORIGIN: baseUrl,
  },
});
let log = "";
next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });
next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });

const browser = await chromium.launch({ headless: true });
try {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Partner Growth Kit QA server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/partner/login/`);
      if (response.status === 200) break;
    } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const partnerA = await browser.newPage({ viewport: { width: 390, height: 844 } });
  partnerA.setDefaultTimeout(5_000);
  await partnerA.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-a-session-token", domain: "127.0.0.1", path: "/partner" }]);
  const response = await partnerA.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "Partner Shop A" }).waitFor({ state: "visible" });
  await partnerA.getByRole("heading", { name: "Review Growth Kit" }).waitFor({ state: "visible" });
  assert.equal(response?.headers()["cache-control"], "private, no-store", "Partner Growth Kit must remain no-store");
  assert.equal(response?.headers()["x-robots-tag"], "noindex, nofollow", "Partner Growth Kit must remain noindex");
  await partnerA.getByText(`https://mens-esthe-kuchikomi.com/r/${tokenQr}/`).waitFor({ state: "visible" });
  const qr = partnerA.getByRole("img", { name: "口コミURLのQRコード" });
  await qr.waitFor({ state: "visible" });
  assert.match(await qr.getAttribute("src") ?? "", /^data:image\/(png|svg\+xml);/i, "the QR must be a local server-derived image asset, not an external tracker");
  await partnerA.getByRole("button", { name: "LINE案内文をコピー" }).click();
  await partnerA.getByText("LINE案内文をコピーしました。").waitFor({ state: "visible" });
  await partnerA.getByRole("button", { name: "Webサイト用CTAをコピー" }).click();
  await partnerA.getByText("Webサイト用CTAをコピーしました。").waitFor({ state: "visible" });
  await partnerA.getByRole("heading", { name: "店舗サイトに口コミWidgetを設置" }).waitFor({ state: "visible" });
  await partnerA.getByText("設置は任意です。").waitFor({ state: "visible" });
  await partnerA.getByRole("link", { name: "Widgetを確認" }).waitFor({ state: "visible" });
  const widgetCode = partnerA.locator("code").filter({ hasText: `/partner/widget/${tokenWebsite}/` });
  await widgetCode.waitFor({ state: "visible" });
  await widgetCode.evaluate((node) => {
    const value = node.textContent ?? "";
    if (!value.includes('title="Partner Shop AのEskomi口コミ"')) throw new Error("widget snippet must name the authorized shop");
    if (!value.includes('style="width:100%;max-width:100%;border:0;min-height:180px;"')) throw new Error("widget snippet must be responsive without site-global JS");
  });
  await partnerA.getByRole("button", { name: "Widgetコードをコピー" }).click();
  await partnerA.getByText("Widgetコードをコピーしました。").waitFor({ state: "visible" });
  await partnerA.getByRole("link", { name: "設置方法を見る" }).click();
  await partnerA.getByRole("heading", { name: "Widgetの設置方法" }).waitFor({ state: "visible" });
  await partnerA.getByText("店舗サイトの任意の表示位置に貼り付けます。").waitFor({ state: "visible" });
  await partnerA.getByText("submitted").waitFor({ state: "visible" });
  await partnerA.getByText("8").first().waitFor({ state: "visible" });
  await partnerA.getByText("pending").waitFor({ state: "visible" });
  await partnerA.getByText("published").waitFor({ state: "visible" });
  await partnerA.getByText("counter_qr").waitFor({ state: "visible" });
  await partnerA.getByText("12").first().waitFor({ state: "visible" });
  assert.equal(await partnerA.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, "390px Growth Kit must not overflow horizontally");
  await partnerA.setViewportSize({ width: 320, height: 844 });
  assert.equal(await partnerA.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, "320px Growth Kit must not overflow horizontally");

  await partnerA.goto(`${baseUrl}/partner/workspace/${workspaceB}/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(metricWorkspaceRequests.includes(workspaceB), false, "a manipulated Partner B workspace must be denied before metrics are requested");
  assert.equal(metricWorkspaceRequests.every((workspaceId) => workspaceId === workspaceA), true, "the server must request only the authorized workspace metrics");

  const publicCampaign = await browser.newPage();
  publicCampaign.setDefaultTimeout(5_000);
  const campaignResponse = await publicCampaign.goto(`${baseUrl}/r/not-a-token/`, { waitUntil: "domcontentloaded" });
  assert.equal(campaignResponse?.status(), 404, "public campaign routing must reject invalid campaign tokens without exposing Partner data");
  await Promise.all([partnerA.close(), publicCampaign.close()]);
  console.log("partner review Growth Kit browser QA passed");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
