import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const screenshotDir = process.env.PARTNER_THERAPIST_QA_SCREENSHOT_DIR;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
const workspaceId = "11111111-1111-4111-8111-111111111111";
const authUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const appShopId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
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
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport, `${label} must not overflow horizontally: ${JSON.stringify(dimensions)}`);
}

const mockPort = await freePort();
const appPort = await freePort();
const mock = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${mockPort}`);
  if (url.pathname === "/auth/v1/user" && request.method === "GET") {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    return token === "partner-session-token"
      ? json(response, 200, { id: authUserId, email: "owner@example.invalid" })
      : json(response, 401, { message: "invalid" });
  }
  if (url.pathname === "/rest/v1/rpc/get_partner_therapist_workspace_scope" && request.method === "POST") {
    return json(response, 200, [{ workspace_id: workspaceId, app_shop_id: appShopId, role: "owner" }]);
  }
  if (url.pathname === "/rest/v1/rpc/list_partner_therapist_assignments" && request.method === "POST") {
    return json(response, 200, []);
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
  },
});
let log = "";
next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4_000); });
next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4_000); });

const browser = await chromium.launch({ headless: true, ...(process.env.ESKOMI_E2E_CHROMIUM ? { executablePath: process.env.ESKOMI_E2E_CHROMIUM } : {}) });
try {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Therapist photo QA server exited before ready\n${log}`);
    try {
      if ((await fetch(`${baseUrl}/partner/login/`)).status === 200) break;
    } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // The real complete-link route scopes the HTTP-only partner session to `/`
  // so that same-origin `/api/partner/*` mutations receive it too.
  await context.addCookies([{ name: "eskomi_partner_access_token", value: "partner-session-token", domain: "127.0.0.1", path: "/" }]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/partner/therapists/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "担当者を管理する" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "担当者を管理する" }).click();
  await page.getByRole("heading", { name: "担当者と個別の口コミリンク" }).waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(page, "390px therapist photo form");

  const photo = page.locator('input[type="file"]');
  const [invalidResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/partner/therapists/photo/") && candidate.request().method() === "POST"),
    photo.setInputFiles({ name: "not-an-image.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") }),
  ]);
  assert.equal(invalidResponse.status(), 400, await invalidResponse.text());
  await page.getByRole("status").getByText("PNG・JPEG・WebPの実画像（最大4096px）を選択してください。").waitFor({ state: "visible" });
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/partner-therapist-invalid-photo-390.png`, fullPage: true });

  const [largeResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/partner/therapists/photo/") && candidate.request().method() === "POST"),
    photo.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }),
  ]);
  assert.equal(largeResponse.status(), 400, await largeResponse.text());
  await page.getByRole("status").getByText("画像は5MB以下にしてください。").waitFor({ state: "visible" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await assertNoHorizontalOverflow(page, "1280px therapist photo form");
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/partner-therapist-too-large-photo-1280.png`, fullPage: true });
  await context.close();
  console.log("partner therapist photo error browser QA: PASS");
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => mock.close(resolve));
}
