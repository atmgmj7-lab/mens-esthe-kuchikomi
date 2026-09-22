import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const workspaceId = "11111111-1111-4111-8111-111111111111";
const authUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

let recordedEmail = null;
const mockPort = await freePort();
const appPort = await freePort();
const mock = http.createServer(async (request, response) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (request.url === "/auth/v1/user" && request.method === "GET") {
    return token === "partner-session-token"
      ? json(response, 200, { id: authUserId, email: "owner@example.invalid" })
      : json(response, 401, { message: "invalid" });
  }
  if (request.url === "/auth/v1/user" && request.method === "PUT") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const parsed = JSON.parse(body);
    return token === "partner-session-token" && parsed.email === "new-owner@example.invalid"
      ? json(response, 200, { id: authUserId, email: "owner@example.invalid", new_email: parsed.email })
      : json(response, 400, { message: "invalid" });
  }
  if (request.url === "/rest/v1/rpc/get_partner_auth_membership" && request.method === "POST") {
    return json(response, 200, [{ workspace_id: workspaceId, wp_shop_id: 101, shop_slug: "shop-a", role: "owner" }]);
  }
  if (request.url === "/rest/v1/rpc/get_partner_workspace_identity" && request.method === "POST") {
    return json(response, 200, [{ workspace_id: workspaceId, wp_shop_id: 101, shop_slug: "shop-a", shop_name: "Partner Shop A", canonical_url: "https://mens-esthe-kuchikomi.com/shops/shop-a/", state: "free_official_partner" }]);
  }
  if (request.url === "/rest/v1/rpc/get_partner_login_email_management" && request.method === "POST") {
    return json(response, 200, [{ status: "not_set", workspace_id: workspaceId, auth_user_id: authUserId, email: null, intent: null, updated_at: null }]);
  }
  if (request.url === "/rest/v1/rpc/record_partner_login_email_change_request" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const parsed = JSON.parse(body);
    recordedEmail = parsed.p_email;
    return json(response, 200, [{ status: "available", workspace_id: workspaceId, auth_user_id: authUserId, email: parsed.p_email, intent: "partner_change_requested", updated_at: "2026-09-23T00:00:00Z" }]);
  }
  return json(response, 404, { message: "not found" });
});
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const baseUrl = `http://127.0.0.1:${appPort}`;
const next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: root,
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
    if (next.exitCode !== null) throw new Error(`Login email QA server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/partner/login/`);
      if (response.status === 200) break;
    } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const anonymous = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await anonymous.goto(`${baseUrl}/partner/settings/`, { waitUntil: "domcontentloaded" });
  await anonymous.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  await anonymous.close();

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    await context.addCookies([{ name: "eskomi_partner_access_token", value: "partner-session-token", domain: "127.0.0.1", path: "/partner" }]);
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}/partner/settings/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "ログインメール" }).waitFor({ state: "visible" });
    assert.equal(response?.headers()["x-robots-tag"], "noindex, nofollow");
    assert.equal(await page.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, `${viewport.width}px settings must not overflow horizontally`);
    if (viewport.width === 390) {
      await page.getByLabel("新しいログインメール").fill("new-owner@example.invalid");
      const [postResponse] = await Promise.all([
        page.waitForResponse((candidate) => candidate.url().endsWith("/partner/settings/login-email/") && candidate.request().method() === "POST"),
        page.getByRole("button", { name: "変更を依頼する" }).click(),
      ]);
      assert.equal(postResponse.status(), 202, await postResponse.text());
      await page.getByRole("status").getByText(/変更を受け付けました/).waitFor({ state: "visible" });
    }
    await context.close();
  }
  assert.equal(recordedEmail, "new-owner@example.invalid", "Partner settings must record only the authenticated Partner's requested email");

  const operator = await browser.newPage();
  const denied = await operator.goto(`${baseUrl}/api/dashboard/shops/768/login-email/`, { waitUntil: "domcontentloaded" });
  assert.equal(denied?.status(), 401, "Operator login email endpoint must retain Basic Auth");
  await operator.close();
  console.log("partner login email management browser QA: PASS");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
