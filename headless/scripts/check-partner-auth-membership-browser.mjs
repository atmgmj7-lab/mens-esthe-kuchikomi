import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userNone = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otpRequests = [];
const serverStateCookieName = "eskomi_partner_login_state";
const handoffStateCookieName = "eskomi_partner_login_state_handoff";
const partnerSessionCookieName = "eskomi_partner_access_token";

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

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport, `${label} must not overflow horizontally: ${JSON.stringify(dimensions)}`);
}

const mockPort = await freePort();
const appPort = await freePort();
const mock = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${mockPort}`);
  if (requestUrl.pathname === "/auth/v1/otp" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const parsed = JSON.parse(body);
    otpRequests.push({ body: parsed, redirectTo: requestUrl.searchParams.get("redirect_to") });
    if (parsed.email === "fail@example.invalid") return json(response, 503, { message: "provider unavailable" });
    return json(response, 200, { user: null, session: null });
  }
  if (request.url === "/auth/v1/user" && request.method === "GET") {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token === "partner-a-session-token") return json(response, 200, { id: userA, email: "a@example.invalid" });
    if (token === "partner-b-session-token") return json(response, 200, { id: userB, email: "b@example.invalid" });
    if (token === "partner-none-session-token") return json(response, 200, { id: userNone, email: "none@example.invalid" });
    return json(response, 401, { message: "invalid" });
  }
  if (request.url === "/rest/v1/rpc/get_partner_auth_membership" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const authUserId = JSON.parse(body).p_auth_user_id;
    return json(response, 200, authUserId === userA || authUserId === userB ? [{
      workspace_id: authUserId === userA ? workspaceA : workspaceB,
      wp_shop_id: authUserId === userA ? 101 : 202,
      shop_slug: authUserId === userA ? "shop-a" : "shop-b",
      role: "owner",
    }] : []);
  }
  if (request.url === "/rest/v1/rpc/get_partner_workspace_identity" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const workspaceId = JSON.parse(body).p_workspace_id;
    return json(response, 200, workspaceId === workspaceA || workspaceId === workspaceB ? [{
      workspace_id: workspaceId,
      wp_shop_id: workspaceId === workspaceA ? 101 : 202,
      shop_slug: workspaceId === workspaceA ? "shop-a" : "shop-b",
      shop_name: workspaceId === workspaceA ? "Shop A" : "Shop B",
      canonical_url: `https://mens-esthe-kuchikomi.com/shops/${workspaceId === workspaceA ? "shop-a" : "shop-b"}/`,
      state: "free_official_partner",
    }] : []);
  }
  if (request.url === "/rest/v1/rpc/get_partner_review_growth_metrics" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const workspaceId = JSON.parse(body).p_workspace_id;
    return json(response, 200, workspaceId === workspaceA || workspaceId === workspaceB ? [{
      workspace_id: workspaceId,
      wp_shop_id: workspaceId === workspaceA ? 101 : 202,
      submitted_reviews: 0,
      pending_reviews: 0,
      public_reviews: 0,
      campaigns: [],
    }] : []);
  }
  return json(response, 404, { message: "not found" });
});
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const baseUrl = `http://127.0.0.1:${appPort}`;
const next = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    SUPABASE_AUTH_PUBLISHABLE_KEY: "fixture-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key",
    PARTNER_AUTH_REDIRECT_ORIGIN: baseUrl,
    DASHBOARD_BASIC_AUTH_USER: "operator",
    DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password",
  },
});
let log = "";
next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });
next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });

const browser = await chromium.launch({ headless: true });
try {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Partner QA server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/partner/login/`);
      if (response.status === 200) break;
    } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const anonymous = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await anonymous.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await anonymous.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(anonymous.url()).pathname, "/partner/login/");

  const loginFlow = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await loginFlow.goto(`${baseUrl}/partner/login/`, { waitUntil: "domcontentloaded" });
  await loginFlow.getByLabel("メールアドレス").fill("a@example.invalid");
  await loginFlow.getByRole("button", { name: "ログイン用リンクを送信" }).click();
  await loginFlow.getByRole("status").waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(loginFlow, "390px Partner login");
  assert.equal(await loginFlow.getByRole("status").innerText(), "登録済みのメールアドレスの場合、ログイン用リンクを送信しました。");
  assert.equal(otpRequests.length, 1, "login start must request Supabase's default magic link");
  assert.equal(
    otpRequests[0].redirectTo,
    `${baseUrl}/partner/auth/callback/`,
    "Supabase must receive the exact allow-listed callback URL through its redirect_to query contract",
  );
  assert.equal("options" in otpRequests[0].body, false, "the raw Auth API request must not rely on an ignored client-library options object");
  const issuedCookies = await loginFlow.context().cookies();
  const stateCookie = issuedCookies.find((cookie) => cookie.name === serverStateCookieName);
  const handoffCookie = issuedCookies.find((cookie) => cookie.name === handoffStateCookieName);
  assert.ok(stateCookie, "magic-link start must bind completion to an HttpOnly server cookie");
  assert.ok(handoffCookie, "magic-link start must issue a callback-readable handoff cookie");
  assert.equal(stateCookie.httpOnly, true, "the authoritative state cookie must remain HttpOnly");
  assert.equal(handoffCookie.httpOnly, false, "the handoff nonce must be readable only by callback JavaScript");
  assert.equal(handoffCookie.value, stateCookie.value, "both state cookies must carry the same nonce");
  assert.equal(stateCookie.path, "/api/partner/auth/complete-link");
  assert.equal(handoffCookie.path, "/partner/auth/callback/");

  const failedProvider = await browser.newContext();
  const failedProviderPage = await failedProvider.newPage({ viewport: { width: 390, height: 844 } });
  await failedProviderPage.goto(`${baseUrl}/partner/login/`, { waitUntil: "domcontentloaded" });
  await failedProvider.addCookies([
    { name: serverStateCookieName, value: "stale-server-state", domain: "127.0.0.1", path: "/api/partner/auth/complete-link" },
    { name: handoffStateCookieName, value: "stale-handoff-state", domain: "127.0.0.1", path: "/partner/auth/callback/" },
  ]);
  await failedProviderPage.getByLabel("メールアドレス").fill("fail@example.invalid");
  await failedProviderPage.getByRole("button", { name: "ログイン用リンクを送信" }).click();
  await failedProviderPage.getByRole("status").waitFor({ state: "visible" });
  const failedCookies = await failedProvider.cookies();
  assert.equal(failedCookies.some((cookie) => cookie.name === serverStateCookieName), false, "provider failure must not issue server state");
  assert.equal(failedCookies.some((cookie) => cookie.name === handoffStateCookieName), false, "provider failure must not issue handoff state");
  await failedProviderPage.close();
  await failedProvider.close();

  const crossUser = await browser.newContext();
  const crossUserPage = await crossUser.newPage({ viewport: { width: 390, height: 844 } });
  await crossUserPage.goto(`${baseUrl}/partner/login/`, { waitUntil: "domcontentloaded" });
  await crossUserPage.getByLabel("メールアドレス").fill("a@example.invalid");
  await crossUserPage.getByRole("button", { name: "ログイン用リンクを送信" }).click();
  await crossUserPage.getByRole("status").waitFor({ state: "visible" });
  await crossUserPage.goto(`${baseUrl}/partner/auth/callback/#access_token=partner-b-session-token`, { waitUntil: "domcontentloaded" });
  await crossUserPage.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(crossUserPage.url()).pathname, "/partner/login/", "a token for another requested email must fail closed");
  assert.equal((await crossUser.cookies()).some((cookie) => cookie.name === partnerSessionCookieName), false, "cross-user completion must not establish a session");
  await crossUserPage.close();
  await crossUser.close();

  const callbackUrl = `${baseUrl}/partner/auth/callback/#access_token=partner-a-session-token`;
  await loginFlow.goto(callbackUrl, { waitUntil: "domcontentloaded" });
  try {
    await loginFlow.getByRole("heading", { name: "Shop A" }).waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    throw new Error(`magic-link completion did not reach the partner gate: ${loginFlow.url()}\n${await loginFlow.locator("body").innerText()}\n${log}`);
  }
  assert.equal(new URL(loginFlow.url()).pathname, "/partner/", "the default magic-link fragment must become an HttpOnly partner session");
  assert.equal(new URL(loginFlow.url()).hash, "", "the access token must not remain in the visible URL");
  const completedCookies = await loginFlow.context().cookies();
  assert.equal(completedCookies.some((cookie) => cookie.name === serverStateCookieName), false, "successful completion must clear server state");
  assert.equal(completedCookies.some((cookie) => cookie.name === handoffStateCookieName), false, "successful completion must clear handoff state");
  assert.equal(completedCookies.find((cookie) => cookie.name === partnerSessionCookieName)?.httpOnly, true, "the Partner session must be HttpOnly");
  await assertNoHorizontalOverflow(loginFlow, "390px Partner Home");
  await loginFlow.setViewportSize({ width: 1280, height: 900 });
  await loginFlow.getByRole("heading", { name: "Shop A" }).waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(loginFlow, "1280px Partner Home");

  async function assertDeniedCompletion({ serverState, handoffState, accessToken }, message) {
    const context = await browser.newContext();
    const page = await context.newPage({ viewport: { width: 390, height: 844 } });
    const cookies = [];
    if (serverState) cookies.push({ name: serverStateCookieName, value: serverState, domain: "127.0.0.1", path: "/api/partner/auth/complete-link" });
    if (handoffState) cookies.push({ name: handoffStateCookieName, value: handoffState, domain: "127.0.0.1", path: "/partner/auth/callback/" });
    if (cookies.length > 0) await context.addCookies(cookies);
    await page.goto(`${baseUrl}/partner/auth/callback/#access_token=${encodeURIComponent(accessToken)}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).pathname, "/partner/login/", message);
    assert.equal(new URL(page.url()).hash, "", "failed completion must also remove the token fragment");
    const remaining = await context.cookies();
    assert.equal(remaining.some((cookie) => cookie.name === serverStateCookieName), false, "denial must clear server state");
    assert.equal(remaining.some((cookie) => cookie.name === handoffStateCookieName), false, "denial must clear handoff state");
    assert.equal(remaining.some((cookie) => cookie.name === partnerSessionCookieName), false, "denial must not establish a Partner session");
    await page.close();
    await context.close();
  }

  await assertDeniedCompletion({ serverState: "server-state-123456", handoffState: null, accessToken: "partner-a-session-token" }, "missing handoff state must fail closed");
  await assertDeniedCompletion({ serverState: "server-state-123456", handoffState: "wrong-state-1234567", accessToken: "partner-a-session-token" }, "mismatched state must fail closed");
  await assertDeniedCompletion({ serverState: null, handoffState: "handoff-state-123456", accessToken: "partner-a-session-token" }, "missing HttpOnly server state must fail closed");
  await assertDeniedCompletion({ serverState: "matching-state-123456", handoffState: "matching-state-123456", accessToken: "invalid-access-token" }, "invalid access token must fail closed");

  const partnerA = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await partnerA.context().addCookies([{ name: partnerSessionCookieName, value: "partner-a-session-token", domain: "127.0.0.1", path: "/partner" }]);
  await partnerA.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "Shop A" }).waitFor({ state: "visible" });

  const noMembership = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await noMembership.context().addCookies([{ name: partnerSessionCookieName, value: "partner-none-session-token", domain: "127.0.0.1", path: "/partner" }]);
  await noMembership.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await noMembership.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(noMembership.url()).pathname, "/partner/login/");

  await partnerA.goto(`${baseUrl}/partner/workspace/${workspaceB}/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(partnerA.url()).pathname, "/partner/login/");

  const operatorBoundary = await browser.newPage();
  const operatorResponse = await operatorBoundary.goto(`${baseUrl}/dashboard/`, { waitUntil: "domcontentloaded" });
  assert.equal(operatorResponse?.status(), 401, "Partner Auth must not satisfy operator Basic Auth");

  await Promise.all([anonymous.close(), loginFlow.close(), partnerA.close(), noMembership.close(), operatorBoundary.close()]);
  console.log("partner auth membership browser QA passed");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
