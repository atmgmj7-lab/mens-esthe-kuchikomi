import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

function stop(child) {
  if (child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise((resolve) => child.once("exit", resolve));
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    DASHBOARD_BASIC_AUTH_USER: "operator",
    DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
});
let log = "";
next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });
next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });

const browser = await chromium.launch({ headless: true });
try {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Operator QA server exited before ready\n${log}`);
    try {
      const response = await fetch(`${baseUrl}/dashboard/shops/`);
      if (response.status === 401) break;
    } catch { /* server has not started */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const unauthorized = await browser.newPage();
  const unauthenticatedResponse = await unauthorized.goto(`${baseUrl}/dashboard/shops/`, { waitUntil: "domcontentloaded" });
  assert.equal(unauthenticatedResponse?.status(), 401, "Operator shops must remain inside existing Basic Auth");
  await unauthorized.close();

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({
      viewport,
      httpCredentials: { username: "operator", password: "fixture-password" },
    });
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}/dashboard/shops/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "店舗管理" }).waitFor({ state: "visible" });
    assert.equal(response?.headers()["x-robots-tag"], "noindex, nofollow");
    assert.match(response?.headers()["cache-control"] ?? "", /private, no-store/);
    assert.equal(await page.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, `${viewport.width}px must not overflow horizontally`);
    await page.getByRole("link", { name: "店舗を追加" }).click();
    await page.getByRole("heading", { name: "店舗を追加" }).waitFor({ state: "visible" });
    await page.getByLabel("店舗名").fill("Local Candidate Shop");
    await page.getByLabel("Area").fill("大阪");
    await page.getByRole("button", { name: "入力を検証する（書込みなし）" }).click();
    await page.getByRole("status").getByText(/書き込みません/).waitFor({ state: "visible" });
    assert.equal(await page.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth), true, `${viewport.width}px form must not overflow horizontally`);
    await context.close();
  }

  console.log("operator shop control center browser QA: PASS");
} finally {
  await browser.close();
  await stop(next);
}
