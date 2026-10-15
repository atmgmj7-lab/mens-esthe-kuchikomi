import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { join } from "node:path";
import { chromium } from "playwright";

// Real Chromium -> real Next -> local Supabase REST/Storage contract. It creates
// one uniquely named local record and removes only that disposable record in finally.
const root = process.cwd();
const projectRoot = join(root, "..");
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const slug = `operator-e2e-${suffix}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLrLwAAAABJRU5ErkJggg==", "base64");

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}
function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const index = line.indexOf("=");
    return index < 1 ? [] : [[line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")]];
  }));
}
function localSupabaseEnv() {
  const env = parseEnv(execFileSync("supabase", ["status", "-o", "env"], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  for (const key of ["API_URL", "PUBLISHABLE_KEY", "SERVICE_ROLE_KEY"]) if (!env[key]) throw new Error(`Local Supabase did not provide ${key}.`);
  return env;
}
function databaseContainer() {
  const projectId = readFileSync(join(projectRoot, "supabase/config.toml"), "utf8").match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!projectId) throw new Error("Missing local Supabase project id.");
  return `supabase_db_${projectId}`;
}
function psql(container, sql) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function quote(value) { return `'${value.replaceAll("'", "''")}'`; }
function basic() { return `Basic ${Buffer.from("operator:fixture-password").toString("base64")}`; }
function stop(child) { return child.exitCode !== null ? Promise.resolve() : new Promise((resolve) => { child.kill("SIGTERM"); child.once("exit", resolve); }); }

const local = localSupabaseEnv();
const apiUrl = local.API_URL.replace(/\/$/, "");
const database = databaseContainer();
const storageAdminHeaders = { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}` };
let next;
let mock;
let browser;
let managedShopId = null;
let objectKey = null;

async function cleanup() {
  if (!managedShopId) return;
  const keys = psql(database, `select object_key from private.managed_shop_assets where managed_shop_id=${quote(managedShopId)}::uuid;`).split("\n").filter(Boolean);
  await Promise.all(keys.map(async (key) => {
    const response = await fetch(`${apiUrl}/storage/v1/object/listing-application-private/${key}`, { method: "DELETE", headers: storageAdminHeaders });
    if (!response.ok && response.status !== 404) throw new Error(`Local managed image cleanup failed with HTTP ${response.status}.`);
  }));
  psql(database, `
    delete from private.managed_shop_publications where managed_shop_id=${quote(managedShopId)}::uuid;
    delete from private.managed_shop_reviews where managed_shop_id=${quote(managedShopId)}::uuid;
    delete from private.managed_shop_revisions where managed_shop_id=${quote(managedShopId)}::uuid;
    delete from private.managed_shop_assets where managed_shop_id=${quote(managedShopId)}::uuid;
    delete from private.managed_shops where id=${quote(managedShopId)}::uuid;
  `);
}

try {
  const mockPort = await freePort();
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  mock = http.createServer((request, response) => {
    if ((request.url ?? "").startsWith("/wp-json/wp/v2/area")) { response.writeHead(200, { "Content-Type": "application/json" }); response.end("[]"); return; }
    if ((request.url ?? "").startsWith("/wp-json/wp/v2/shop")) { response.writeHead(200, { "Content-Type": "application/json", "X-WP-Total": "0", "X-WP-TotalPages": "0" }); response.end("[]"); return; }
    response.writeHead(404); response.end();
  });
  await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
  next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SHOP_DIRECTORY_SOURCE: "supabase", SUPABASE_URL: apiUrl, SUPABASE_AUTH_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY, DASHBOARD_BASIC_AUTH_USER: "operator", DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password", WP_API_BASE_URL: `http://127.0.0.1:${mockPort}/wp-json` },
  });
  let log = "";
  next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-3000); });
  next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-3000); });
  for (let deadline = Date.now() + 30_000; ; await new Promise((resolve) => setTimeout(resolve, 200))) {
    if (next.exitCode !== null) throw new Error(`Managed shop E2E server stopped before ready: ${log}`);
    try { if ((await fetch(`${baseUrl}/dashboard/shops/new/`)).status === 401) break; } catch { /* wait */ }
    if (Date.now() > deadline) throw new Error(`Managed shop E2E server timed out: ${log}`);
  }
  console.log("operator managed shop E2E: Next server ready");
  assert.equal((await fetch(`${baseUrl}/api/dashboard/managed-shops/`)).status, 401, "anonymous operator mutation API must be denied");
  const csrfRejected = await fetch(`${baseUrl}/api/dashboard/managed-shops/`, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/json", Origin: baseUrl }, body: JSON.stringify({ action: "create" }) });
  assert.equal(csrfRejected.status, 403, "operator mutation API must require the CSRF header");

  browser = await chromium.launch({ headless: true });
  console.log("operator managed shop E2E: Chromium launched");
  const anonymous = await browser.newPage();
  console.log("operator managed shop E2E: anonymous browser page created");
  assert.equal((await anonymous.goto(`${baseUrl}/api/dashboard/managed-shops/`))?.status(), 401, "anonymous browser request must be denied");
  const operator = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  operator.setDefaultTimeout(5_000);
  console.log("operator managed shop E2E: authenticated browser page created");
  await operator.context().setHTTPCredentials({ username: "operator", password: "fixture-password" });
  console.log("operator managed shop E2E: dashboard navigation started");
  const newShopResponse = await operator.goto(`${baseUrl}/dashboard/shops/new/`, { waitUntil: "domcontentloaded", timeout: 10_000 });
  console.log(`operator managed shop E2E: dashboard new-shop page loaded (${newShopResponse?.status()})`);
  const newShopText = await operator.locator("body").innerText();
  assert.match(newShopText, /店舗を下書きで追加/, "new-shop dashboard form must render");
  console.log("operator managed shop E2E: filling creation form");
  await operator.locator('input[name="slug"]').fill(slug);
  await operator.locator('input[name="shop_name"]').fill("実接続の新規管理店舗");
  await operator.locator('input[name="area_slug"]').fill("osaka");
  await operator.locator('input[name="area_name"]').fill("大阪市");
  await operator.locator('textarea[name="introduction"]').fill("承認されるまで公開しない実接続の紹介文");
  const [createResponse] = await Promise.all([
    operator.waitForResponse((response) => response.url().endsWith("/api/dashboard/managed-shops/") && response.request().method() === "POST"),
    operator.getByRole("button", { name: "下書きを作成する" }).click(),
  ]);
  assert.equal(createResponse.status(), 200, "managed shop creation must succeed");
  await operator.waitForURL(/\/dashboard\/shops\/managed\/[0-9a-f-]+\/$/);
  managedShopId = operator.url().match(/managed\/([0-9a-f-]+)\//)?.[1] ?? null;
  assert.match(managedShopId ?? "", /^[0-9a-f-]{36}$/i, "new managed shop must receive a private UUID identity");
  console.log("operator managed shop E2E: draft created");

  await operator.locator('input[type="file"]').setInputFiles({ name: "managed-banner.png", mimeType: "image/png", buffer: png });
  const [upload] = await Promise.all([
    operator.waitForResponse((response) => response.url().includes(`/api/dashboard/managed-shops/${managedShopId}/asset/`) && response.request().method() === "POST"),
    operator.getByRole("button", { name: "画像をprivate保存する" }).click(),
  ]);
  assert.equal(upload.status(), 200, `private image upload failed: ${await upload.text()}`);
  await operator.getByText("private画像を下書きへ追加しました").waitFor();
  const asset = psql(database, `select id || '|' || object_key from private.managed_shop_assets where managed_shop_id=${quote(managedShopId)}::uuid order by created_at desc limit 1;`).split("|");
  assert.match(asset[0] ?? "", /^[0-9a-f-]{36}$/i, "managed banner must have an asset record");
  objectKey = asset[1] ?? null;
  const privateRead = await fetch(`${apiUrl}/storage/v1/object/listing-application-private/${objectKey}`, { headers: { apikey: local.PUBLISHABLE_KEY } });
  assert.notEqual(privateRead.status, 200, "managed image object must remain private before approval");
  assert.equal((await fetch(`${baseUrl}/api/managed-shops/assets/${asset[0]}/`)).status, 404, "unapproved managed image proxy must deny public access");
  await operator.getByRole("button", { name: "下書きを保存する" }).click();
  await operator.getByText("保存しました。画面を再読込して最新状態を確認してください。").waitFor();
  await operator.reload({ waitUntil: "domcontentloaded" });
  await operator.getByRole("button", { name: "審査へ提出する" }).click();
  await operator.getByText("保存しました。画面を再読込して最新状態を確認してください。").waitFor();
  await operator.reload({ waitUntil: "domcontentloaded" });
  await operator.getByRole("button", { name: "承認して公開する" }).click();
  await operator.getByText("保存しました。画面を再読込して最新状態を確認してください。").waitFor();
  console.log("operator managed shop E2E: private image, submit, and approval completed");

  const stale = await fetch(`${baseUrl}/api/dashboard/managed-shops/`, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/json", "X-ESKOMI-CSRF": "managed-shop-write", Origin: baseUrl }, body: JSON.stringify({ action: "review", managedShopId, expectedRevision: 1, decision: "approved" }) });
  assert.equal(stale.status, 409, "stale operator review must be rejected");
  const publicPage = await browser.newPage();
  assert.equal((await publicPage.goto(`${baseUrl}/shops/${slug}/`, { waitUntil: "domcontentloaded" }))?.status(), 200, "approved managed shop must have a stable public URL");
  await publicPage.getByRole("heading", { name: "実接続の新規管理店舗" }).waitFor();
  assert.equal((await publicPage.goto(`${baseUrl}/api/managed-shops/assets/${asset[0]}/`))?.status(), 200, "approved managed image must be served through the public proxy");
  console.log("operator managed shop E2E: approved public shop and image verified");

  await operator.reload({ waitUntil: "domcontentloaded" });
  await operator.getByRole("button", { name: "公開を停止する" }).click();
  await operator.getByText("保存しました。画面を再読込して最新状態を確認してください。").waitFor();
  assert.equal((await fetch(`${baseUrl}/api/managed-shops/assets/${asset[0]}/`)).status, 404, "unlisted managed image must no longer be public");
  const unlistedResponse = await publicPage.goto(`${baseUrl}/shops/${slug}/?visibility-check=unlisted`, { waitUntil: "domcontentloaded" });
  assert.equal(unlistedResponse?.status(), 200, "PPR not-found shell should render");
  const unlistedText = await publicPage.locator("body").innerText();
  assert.match(unlistedText, /ページが見つかりません/, "unlisted managed shop must render as not found");
  assert.doesNotMatch(unlistedText, /実接続の新規管理店舗/, "unlisted managed shop content must not be public");
  await operator.reload({ waitUntil: "domcontentloaded" });
  await operator.getByRole("button", { name: "公開する", exact: true }).click();
  await operator.getByText("保存しました。画面を再読込して最新状態を確認してください。").waitFor();
  assert.equal((await publicPage.goto(`${baseUrl}/shops/${slug}/?visibility-check=republished`, { waitUntil: "domcontentloaded" }))?.status(), 200, "republished managed shop must return to its stable public URL");
  await Promise.all([anonymous.close(), operator.close(), publicPage.close()]);
  console.log("operator managed shop local Supabase browser E2E: PASS");
} catch (error) {
  console.log(`operator managed shop E2E failure: ${error instanceof Error ? error.stack : String(error)}`);
  throw error;
} finally {
  await browser?.close();
  await stop(next ?? { exitCode: 0 });
  await new Promise((resolve) => mock ? mock.close(resolve) : resolve());
  await cleanup();
}
