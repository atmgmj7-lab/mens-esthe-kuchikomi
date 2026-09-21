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
  if (request.url === "/auth/v1/user" && request.method === "GET") {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token === "partner-a-session-token") return json(response, 200, { id: userA, email: "a@example.invalid" });
    if (token === "partner-none-session-token") return json(response, 200, { id: userNone, email: "none@example.invalid" });
    return json(response, 401, { message: "invalid" });
  }
  if (request.url === "/rest/v1/rpc/get_partner_auth_membership" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    return json(response, 200, JSON.parse(body).p_auth_user_id === userA ? [{
      workspace_id: workspaceA,
      wp_shop_id: 101,
      shop_slug: "shop-a",
      role: "owner",
    }] : []);
  }
  if (request.url === "/rest/v1/rpc/get_partner_workspace_identity" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    return json(response, 200, JSON.parse(body).p_workspace_id === workspaceA ? [{
      workspace_id: workspaceA,
      wp_shop_id: 101,
      shop_slug: "shop-a",
      shop_name: "Partner Shop A",
      canonical_url: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
      state: "free_official_partner",
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
    if (next.exitCode !== null) throw new Error(`Partner Dashboard QA server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/partner/login/`);
      if (response.status === 200) break;
    } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const anonymous = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const anonymousResponse = await anonymous.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await anonymous.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });
  assert.equal(anonymousResponse?.headers()["cache-control"], "private, no-store", "Partner routes must be no-store");
  assert.equal(anonymousResponse?.headers()["x-robots-tag"], "noindex, nofollow", "Partner routes must be noindex");

  const partnerA = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await partnerA.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-a-session-token", domain: "127.0.0.1", path: "/partner" }]);
  const partnerResponse = await partnerA.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "Partner Shop A" }).waitFor({ state: "visible" });
  await partnerA.getByText("Free Official Partner").waitFor({ state: "visible" });
  assert.equal(partnerResponse?.headers()["cache-control"], "private, no-store");
  assert.equal(partnerResponse?.headers()["x-robots-tag"], "noindex, nofollow");
  assert.equal(await partnerA.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, "390px Partner shell must not overflow horizontally");
  await partnerA.setViewportSize({ width: 320, height: 844 });
  assert.equal(await partnerA.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, "320px Partner shell must not overflow horizontally");

  await partnerA.goto(`${baseUrl}/partner/workspace/${workspaceB}/`, { waitUntil: "domcontentloaded" });
  await partnerA.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });

  const noMembership = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await noMembership.context().addCookies([{ name: "eskomi_partner_access_token", value: "partner-none-session-token", domain: "127.0.0.1", path: "/partner" }]);
  await noMembership.goto(`${baseUrl}/partner/`, { waitUntil: "domcontentloaded" });
  await noMembership.getByRole("heading", { name: "パートナーログイン" }).waitFor({ state: "visible" });

  const operatorBoundary = await browser.newPage();
  const operatorResponse = await operatorBoundary.goto(`${baseUrl}/dashboard/`, { waitUntil: "domcontentloaded" });
  assert.equal(operatorResponse?.status(), 401, "Partner Auth must not satisfy operator Basic Auth");

  const publicShop = await browser.newPage();
  const publicShopResponse = await publicShop.goto(`${baseUrl}/shops/eskomi-m0757/`, { waitUntil: "domcontentloaded" });
  assert.equal(publicShopResponse?.status(), 200, "the public shop route must remain available without Partner Auth");
  assert.doesNotMatch(await publicShop.locator("body").innerText(), /Partner workspace|Free Official Partner/, "public Shop HTML must not contain Partner-private identity or status");

  await Promise.all([anonymous.close(), partnerA.close(), noMembership.close(), operatorBoundary.close(), publicShop.close()]);
  console.log("partner dashboard shell browser QA passed");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
