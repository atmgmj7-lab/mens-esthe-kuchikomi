import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const root = process.cwd();
const screenshotDir = process.env.PARTNER_LISTING_E2E_SCREENSHOT_DIR;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const storeId = "33333333-3333-4333-8333-333333333333";
const bannerId = "44444444-4444-4444-8444-444444444444";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLrLwAAAABJRU5ErkJggg==", "base64");

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const body = async (req) => { let text = ""; for await (const chunk of req) text += chunk; return text ? JSON.parse(text) : {}; };
const stop = (child) => child.exitCode !== null ? Promise.resolve() : new Promise((resolve) => { child.kill("SIGTERM"); child.once("exit", resolve); });

let current = { revision: 1, state: "draft", introduction: "承認前の紹介文", banner_asset_id: null };
let latestReview = null;
let publicProjection = null;
let uploadedObject = false;
const requests = [];
const mockPort = await freePort();
const appPort = await freePort();
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${mockPort}`); const payload = await body(req).catch(() => ({})); requests.push({ path: url.pathname, payload });
  if (url.pathname === "/auth/v1/user") { const token = req.headers.authorization?.replace(/^Bearer\s+/i, ""); return json(res, 200, token === "partner-a-session-token" ? { id: userA, email: "a@example.invalid" } : token === "partner-b-session-token" ? { id: userB, email: "b@example.invalid" } : {}); }
  if (url.pathname === "/rest/v1/rpc/get_partner_auth_membership") return json(res, 200, payload.p_auth_user_id === userA ? [{ workspace_id: workspaceA, wp_shop_id: 101, shop_slug: "listing-test", role: "owner" }] : payload.p_auth_user_id === userB ? [{ workspace_id: workspaceB, wp_shop_id: 202, shop_slug: "other-shop", role: "owner" }] : []);
  if (url.pathname === "/rest/v1/rpc/get_partner_listing_editor") {
    if (payload.p_workspace_id !== workspaceA) return json(res, 200, null);
    return json(res, 200, { store_id: storeId, shop_slug: "listing-test", canonical_url: "http://127.0.0.1:" + appPort + "/shops/listing-test/", current_revision: current.revision, revision: { ...current, shop_name: "新規テスト店舗", area: "大阪市", website_url: "https://example.invalid/" }, latest_review: latestReview });
  }
  if (url.pathname === "/rest/v1/rpc/reserve_partner_listing_banner_upload") return payload.p_workspace_id === workspaceA ? json(res, 200, `listing-stores/${storeId}/55555555-5555-4555-8555-555555555555.png`) : json(res, 403, {});
  if (url.pathname.startsWith("/storage/v1/object/listing-application-private/")) { if (req.method === "POST") { uploadedObject = true; return json(res, 200, {}); } if (req.method === "GET") return publicProjection?.banner_asset_id === bannerId ? res.end(png) : json(res, 404, {}); return json(res, 200, {}); }
  if (url.pathname === "/rest/v1/rpc/attach_partner_listing_banner_asset") return payload.p_workspace_id === workspaceA && uploadedObject ? json(res, 200, bannerId) : json(res, 403, {});
  if (url.pathname === "/rest/v1/rpc/save_partner_listing_draft") { if (payload.p_workspace_id !== workspaceA) return json(res, 200, "forbidden"); if (payload.p_expected_revision !== current.revision || !["draft", "changes_requested"].includes(current.state)) return json(res, 200, "conflict"); current = { revision: current.revision + 1, state: "draft", introduction: payload.p_payload.introduction, banner_asset_id: payload.p_payload.banner_asset_id ?? null }; return json(res, 200, "ok"); }
  if (url.pathname === "/rest/v1/rpc/submit_partner_listing_change") { if (payload.p_workspace_id !== workspaceA) return json(res, 200, "forbidden"); if (payload.p_expected_revision !== current.revision || current.state !== "draft") return json(res, 200, "conflict"); current.state = "submitted"; return json(res, 200, "ok"); }
  if (url.pathname === "/rest/v1/rpc/get_partner_listing_review_queue") return json(res, 200, current.state === "submitted" ? [{ store_id: storeId, shop_slug: "listing-test", revision: current.revision, shop_name: "新規テスト店舗", area: "大阪市", website_url: "https://example.invalid/", introduction: current.introduction, banner_asset_id: current.banner_asset_id, current_public: publicProjection?.introduction ?? null }] : []);
  if (url.pathname === "/rest/v1/rpc/review_partner_listing_change") { if (payload.p_listing_store_id !== storeId || payload.p_expected_revision !== current.revision || current.state !== "submitted") return json(res, 200, "conflict"); if (payload.p_decision === "changes_requested") { current.state = "changes_requested"; latestReview = { decision: "changes_requested", note: payload.p_note, created_at: new Date().toISOString() }; return json(res, 200, "ok"); } current.state = "approved"; latestReview = { decision: "approved", note: payload.p_note, created_at: new Date().toISOString() }; publicProjection = { shop_slug: "listing-test", canonical_url: `http://127.0.0.1:${appPort}/shops/listing-test/`, shop_name: "新規テスト店舗", area: "大阪市", website_url: "https://example.invalid/", introduction: current.introduction, banner_asset_id: current.banner_asset_id, approved_revision: current.revision }; return json(res, 200, "ok"); }
  if (url.pathname === "/rest/v1/rpc/get_public_listing_store_by_slug") return json(res, 200, payload.p_shop_slug === publicProjection?.shop_slug ? [publicProjection] : []);
  if (url.pathname === "/rest/v1/rpc/get_public_partner_listing_banner") return json(res, 200, payload.p_asset_id === bannerId && publicProjection?.banner_asset_id === bannerId ? [{ object_key: `listing-stores/${storeId}/55555555-5555-4555-8555-555555555555.png`, content_type: "image/png" }] : []);
  if (url.pathname.startsWith("/wp-json/wp/v2/shop")) {
    if (url.searchParams.get("slug") === "existing-test") return json(res, 200, [{
      id: 901,
      status: "publish",
      date: "2026-10-14T00:00:00",
      modified: "2026-10-14T00:00:00",
      slug: "existing-test",
      link: `${baseUrl}/shops/existing-test/`,
      title: { rendered: "既存テスト店舗" },
      content: { rendered: "既存の WordPress 紹介文" },
      excerpt: { rendered: "" },
      acf: { official_url: "https://legacy.example.invalid/" },
      _embedded: { "wp:term": [[]] },
    }]);
    return json(res, 200, []);
  }
  if (url.pathname.includes("/wp/v2/area")) return json(res, 200, []);
  return json(res, 404, {});
});
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${appPort}`;
const next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${mockPort}`, SUPABASE_AUTH_PUBLISHABLE_KEY: "fixture-publishable-key", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key", DASHBOARD_BASIC_AUTH_USER: "operator", DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password", PARTNER_AUTH_REDIRECT_ORIGIN: baseUrl, WP_API_BASE_URL: `http://127.0.0.1:${mockPort}/wp-json` } });
let log = ""; next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-3000); }); next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-3000); });
const browser = await chromium.launch({ headless: true, ...(process.env.ESKOMI_E2E_CHROMIUM ? { executablePath: process.env.ESKOMI_E2E_CHROMIUM } : {}) });
try {
  for (let deadline = Date.now() + 30_000; ; await new Promise((resolve) => setTimeout(resolve, 200))) { if (next.exitCode !== null) throw new Error(log); try { if ((await fetch(`${baseUrl}/partner/listing/`)).status === 200) break; } catch {} if (Date.now() > deadline) throw new Error(`fixture start timeout\n${log}`); }
  const anon = await browser.newPage(); assert.equal((await anon.request.get(`${baseUrl}/api/dashboard/partner-listing-revisions/`)).status(), 401, "anonymous operator API must be rejected");
  const partner = await browser.newPage({ viewport: { width: 390, height: 844 } }); await partner.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-a-session-token", domain: "127.0.0.1", path: "/" }]);
  await partner.goto(`${baseUrl}/partner/listing/`, { waitUntil: "domcontentloaded" }); await partner.getByRole("heading", { name: "新規テスト店舗" }).waitFor();
  await partner.locator('input[type="file"]').setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png }); await partner.getByText("画像を保管しました").waitFor();
  await partner.getByRole("button", { name: "下書きを保存" }).click(); await partner.getByRole("button", { name: "変更を申請する" }).waitFor(); await partner.getByRole("button", { name: "変更を申請する" }).click(); await partner.getByText("状態：承認待ち").waitFor();
  await partner.goto(`${baseUrl}/shops/listing-test/`); assert.doesNotMatch(await partner.locator("body").innerText(), /承認前の紹介文|新規テスト店舗/, "unapproved new listing must stay non-public"); assert.equal((await partner.goto(`${baseUrl}/api/partner/listing/banner/${bannerId}/`))?.status(), 404, "unapproved banner must stay private");
  const operator = await browser.newPage({ viewport: { width: 1280, height: 900 } }); await operator.context().setHTTPCredentials({ username: "operator", password: "fixture-password" }); await operator.goto(`${baseUrl}/dashboard/listing-applications/partner-revisions/`, { waitUntil: "domcontentloaded" }); await operator.locator("table").getByText("新規テスト店舗").waitFor(); operator.once("dialog", (dialog) => dialog.accept("紹介文を具体化してください。")); await operator.getByRole("button", { name: "差し戻し" }).first().click(); await operator.getByText("確認待ちの本人編集はありません。").waitFor();
  await partner.goto(`${baseUrl}/partner/listing/`, { waitUntil: "domcontentloaded" }); await partner.getByText("紹介文を具体化してください。").waitFor(); await partner.getByRole("textbox", { name: "紹介文" }).fill("差し戻し後に修正した紹介文"); await partner.getByRole("button", { name: "下書きを保存" }).click(); await partner.getByRole("button", { name: "変更を申請する" }).click();
  await operator.reload({ waitUntil: "domcontentloaded" }); await operator.locator("table").getByText("差し戻し後に修正した紹介文").waitFor(); operator.once("dialog", (dialog) => dialog.accept("確認済み")); await operator.getByRole("button", { name: "承認して公開" }).first().click(); await operator.getByText("確認待ちの本人編集はありません。").waitFor();
  const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } }); assert.equal((await publicPage.goto(`${baseUrl}/shops/listing-test/`, { waitUntil: "domcontentloaded" }))?.status(), 200); await publicPage.getByText("差し戻し後に修正した紹介文").waitFor(); assert.equal(await publicPage.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, "SP public page must not overflow"); if (screenshotDir) await publicPage.screenshot({ path: `${screenshotDir}/partner-listing-390.png`, fullPage: true }); await publicPage.setViewportSize({ width: 1280, height: 900 }); assert.equal(await publicPage.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, "PC public page must not overflow"); if (screenshotDir) await publicPage.screenshot({ path: `${screenshotDir}/partner-listing-1280.png`, fullPage: true }); assert.equal((await publicPage.goto(`${baseUrl}/api/partner/listing/banner/${bannerId}/`))?.status(), 200, "approved banner must be public");
  publicProjection = { shop_slug: "existing-test", canonical_url: `${baseUrl}/shops/existing-test/`, shop_name: "既存テスト店舗", area: "大阪市北区", website_url: "https://overlay.example.invalid/", introduction: "既存店舗の承認済み紹介文", banner_asset_id: null, approved_revision: 7 };
  const existingPublic = await browser.newPage({ viewport: { width: 1280, height: 900 } }); assert.equal((await existingPublic.goto(`${baseUrl}/shops/existing-test/`, { waitUntil: "domcontentloaded" }))?.status(), 200); await existingPublic.getByText("既存店舗の承認済み紹介文").waitFor(); assert.equal(await existingPublic.getByRole("link", { name: "公式サイトを見る" }).getAttribute("href"), "https://overlay.example.invalid/", "approved Partner fields must overlay the original WordPress slug");
  const other = await browser.newPage(); await other.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-b-session-token", domain: "127.0.0.1", path: "/" }]); await other.goto(`${baseUrl}/partner/listing/`); assert.equal(await other.evaluate(async () => (await fetch("/api/partner/listing/")).status), 403, "other store must be denied"); assert.equal(await operator.evaluate(async () => (await fetch("/api/dashboard/partner-listing-revisions/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: "33333333-3333-4333-8333-333333333333", revision: 2, decision: "approved" }) })).status), 409, "stale approval must be denied");
  await Promise.all([anon.close(), partner.close(), operator.close(), publicPage.close(), existingPublic.close(), other.close()]); console.log("partner listing editor browser E2E: PASS");
} finally { await browser.close(); await stop(next); await new Promise((resolve) => mock.close(resolve)); }
