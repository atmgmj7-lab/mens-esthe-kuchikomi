import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userNone = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otpRequests = [];

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
const mock = http.createServer(async (request, response) => {
  if (request.url === "/auth/v1/otp" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    otpRequests.push(JSON.parse(body));
    return json(response, 200, { user: null, session: null });
  }
  if (request.url === "/auth/v1/user" && request.method === "GET") {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token === "partner-a-session-token") return json(response, 200, { id: userA, email: "a@example.invalid" });
    if (token === "partner-none-session-token") return json(response, 200, { id: userNone, email: "none@example.invalid" });
    return json(response, 401, { message: "invalid" });
  }
  if (request.url === "/rest/v1/rpc/get_partner_auth_membership" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const authUserId = JSON.parse(body).p_auth_user_id;
    return json(response, 200, authUserId === userA ? [{
      workspace_id: workspaceA,
      wp_shop_id: 101,
      shop_slug: "shop-a",
      role: "owner",
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
  assert.equal(await loginFlow.getByRole("status").innerText(), "登録済みのメールアドレスの場合、ログイン用リンクを送信しました。");
  assert.equal(otpRequests.length, 1, "login start must request Supabase's default magic link");
  const stateCookie = (await loginFlow.context().cookies(`${baseUrl}/api/partner/auth/complete-link/`))
    .find((cookie) => cookie.name === "eskomi_partner_login_state");
  assert.ok(stateCookie, "magic-link start must bind the completion to the initiating browser");
  const callbackUrl = `${baseUrl}/partner/auth/callback/?state=${encodeURIComponent(stateCookie.value)}#access_token=partner-a-session-token`;
  await loginFlow.goto(callbackUrl, { waitUntil: "domcontentloaded" });
  try {
    await loginFlow.getByRole("heading", { name: "パートナーアクセスを確認しました" }).waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    throw new Error(`magic-link completion did not reach the partner gate: ${loginFlow.url()}\n${await loginFlow.locator("body").innerText()}\n${log}`);
  }
  assert.equal(new URL(loginFlow.url()).pathname, "/partner/", "the default magic-link fragment must become an HttpOnly partner session");

  const csrfContext = await browser.newContext();
  const csrfPage = await csrfContext.newPage({ viewport: { width: 390, height: 844 } });
  await csrfPage.goto(callbackUrl, { waitUntil: "domcontentloaded" });
  await csrfPage.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(csrfPage.url()).pathname, "/partner/login/", "a magic link opened outside the initiating browser must not overwrite a session");

  const partnerA = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await partnerA.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-a-session-token", domain: "127.0.0.1", path: "/partner" }]);
  await partnerA.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "パートナーアクセスを確認しました" }).waitFor({ state: "visible" });

  const noMembership = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await noMembership.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-none-session-token", domain: "127.0.0.1", path: "/partner" }]);
  await noMembership.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await noMembership.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(noMembership.url()).pathname, "/partner/login/");

  await partnerA.goto(`${baseUrl}/partner/workspace/${workspaceB}/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(new URL(partnerA.url()).pathname, "/partner/login/");

  const operatorBoundary = await browser.newPage();
  const operatorResponse = await operatorBoundary.goto(`${baseUrl}/dashboard/`, { waitUntil: "domcontentloaded" });
  assert.equal(operatorResponse?.status(), 401, "Partner Auth must not satisfy operator Basic Auth");

  await Promise.all([anonymous.close(), loginFlow.close(), partnerA.close(), noMembership.close(), operatorBoundary.close(), csrfPage.close(), csrfContext.close()]);
  console.log("partner auth membership browser QA passed");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
