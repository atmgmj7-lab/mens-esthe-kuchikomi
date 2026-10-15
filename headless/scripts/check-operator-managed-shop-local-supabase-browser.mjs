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
const legacyId = 840000001;
const legacySlug = `legacy-import-${suffix}`;
const legacyShop = {
  id: legacyId, type: "shop", status: "publish", date: "2026-01-01T00:00:00", modified: "2026-10-15T00:00:00", slug: legacySlug,
  link: `https://mens-esthe-kuchikomi.com/shops/${legacySlug}/`, title: { rendered: "既存取込テスト店舗" }, content: { rendered: "既存の紹介文" }, excerpt: { rendered: "既存の紹介文" },
  official_url: "https://example.test/legacy-official", area_slug: "osaka", area: [101],
  acf: { shop_primary_area_term_id: 101, basic_price: "11000", price_90: "15000", address: "既存住所", business_hours: "既存営業時間", phone: "06-1111-2222", line_url: "https://line.me/legacy", booking_url: "https://example.test/legacy-booking" },
  _embedded: { "wp:term": [[{ id: 101, count: 1, name: "大阪市", slug: "osaka", parent: 0, taxonomy: "area" }]] },
};

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
let importedManagedShopId = null;
let objectKey = null;

async function cleanup() {
  const ids = [managedShopId, importedManagedShopId].filter(Boolean);
  if (!ids.length) return;
  const idList = ids.map((id) => `${quote(id)}::uuid`).join(",");
  const keys = psql(database, `select object_key from private.managed_shop_assets where managed_shop_id in (${idList});`).split("\n").filter(Boolean);
  await Promise.all(keys.map(async (key) => {
    const response = await fetch(`${apiUrl}/storage/v1/object/listing-application-private/${key}`, { method: "DELETE", headers: storageAdminHeaders });
    if (!response.ok && response.status !== 404) throw new Error(`Local managed image cleanup failed with HTTP ${response.status}.`);
  }));
  psql(database, `
    delete from private.managed_shop_publications where managed_shop_id in (${idList});
    delete from private.managed_shop_reviews where managed_shop_id in (${idList});
    delete from private.managed_shop_revisions where managed_shop_id in (${idList});
    delete from private.managed_shop_assets where managed_shop_id in (${idList});
    delete from private.managed_shops where id in (${idList});
  `);
}

try {
  const mockPort = await freePort();
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  mock = http.createServer((request, response) => {
    const path = request.url ?? "";
    if (path.startsWith("/wp-json/wp/v2/area")) { response.writeHead(200, { "Content-Type": "application/json" }); response.end("[]"); return; }
    if (path.startsWith(`/wp-json/wp/v2/shop/${legacyId}`)) { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(legacyShop)); return; }
    if (path.startsWith("/wp-json/wp/v2/shop")) {
      const managedSlugQuery = `slug=${encodeURIComponent(slug)}`;
      const exactManagedLookup = path.includes(managedSlugQuery) || path.includes(`search=${encodeURIComponent(slug)}`);
      response.writeHead(200, { "Content-Type": "application/json", "X-WP-Total": exactManagedLookup ? "0" : "1", "X-WP-TotalPages": "1" });
      response.end(JSON.stringify(exactManagedLookup ? [] : [legacyShop])); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
  next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SHOP_DIRECTORY_SOURCE: "supabase", SUPABASE_URL: apiUrl, SUPABASE_AUTH_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY, DASHBOARD_BASIC_AUTH_USER: "operator", DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password", WP_API_BASE_URL: `http://127.0.0.1:${mockPort}/wp-json`, WP_ALLOW_INSECURE_API_BASE: "1" },
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
  const existingResponse = await operator.goto(`${baseUrl}/dashboard/shops/${legacyId}/`, { waitUntil: "domcontentloaded", timeout: 10_000 });
  assert.equal(existingResponse?.status(), 200, "existing WordPress shop must be available for import");
  await operator.getByRole("button", { name: "Web管理で編集する" }).click();
  await operator.waitForURL(/\/dashboard\/shops\/managed\/[0-9a-f-]+\/$/);
  importedManagedShopId = operator.url().match(/managed\/([0-9a-f-]+)\//)?.[1] ?? null;
  assert.match(importedManagedShopId ?? "", /^[0-9a-f-]{36}$/i, "existing shop import must create its private management identity");
  const imported = psql(database, `select r.shop_name || '|' || r.area_slug || '|' || r.area_name || '|' || r.official_url from private.managed_shops s join private.managed_shop_revisions r on r.managed_shop_id=s.id and r.revision=s.current_revision where s.id=${quote(importedManagedShopId)}::uuid;`);
  assert.equal(imported, "既存取込テスト店舗|osaka|大阪市|https://example.test/legacy-official", "import must retain the existing shop identity and editable public fields");
  console.log("operator managed shop E2E: existing shop import verified");
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
  await operator.locator('input[name="official_url"]').fill("https://example.test/operator-official");
  await operator.locator('textarea[name="introduction"]').fill("承認されるまで公開しない実接続の紹介文");
  await operator.locator('input[name="address"]').fill("大阪府大阪市テスト町1-2-3");
  await operator.locator('input[name="business_hours"]').fill("10:00-翌2:00");
  await operator.locator('input[name="phone"]').fill("06-9999-0000");
  await operator.locator('input[name="line_url"]').fill("https://line.me/R/test");
  await operator.locator('input[name="booking_url"]').fill("https://example.test/operator-booking");
  await operator.locator('input[name="basic_price"]').fill("12000");
  await operator.locator('input[name="price_90"]').fill("15000");
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
  await operator.locator('select[name="asset_role"]').selectOption("gallery");
  await operator.locator('input[name="image"]').setInputFiles({ name: "managed-gallery.png", mimeType: "image/png", buffer: png });
  const [galleryUpload] = await Promise.all([
    operator.waitForResponse((response) => response.url().includes(`/api/dashboard/managed-shops/${managedShopId}/asset/`) && response.request().method() === "POST"),
    operator.getByRole("button", { name: "画像をprivate保存する" }).click(),
  ]);
  assert.equal(galleryUpload.status(), 200, `private gallery upload failed: ${await galleryUpload.text()}`);
  await operator.getByText("ギャラリー画像 1 / 10").waitFor();
  const asset = psql(database, `select id || '|' || object_key from private.managed_shop_assets where managed_shop_id=${quote(managedShopId)}::uuid order by created_at desc limit 1;`).split("|");
  assert.match(asset[0] ?? "", /^[0-9a-f-]{36}$/i, "managed banner must have an asset record");
  objectKey = asset[1] ?? null;
  const privateRead = await fetch(`${apiUrl}/storage/v1/object/listing-application-private/${objectKey}`, { headers: { apikey: local.PUBLISHABLE_KEY } });
  assert.notEqual(privateRead.status, 200, "managed image object must remain private before approval");
  assert.equal((await fetch(`${baseUrl}/api/managed-shops/assets/${asset[0]}/`)).status, 404, "unapproved managed image proxy must deny public access");
  await operator.getByRole("button", { name: "下書きを保存する" }).click();
  await operator.getByText("保存しました。画面を再読込して最新状態を確認してください。").waitFor();
  const saved = psql(database, `select r.shop_name || '|' || r.official_url || '|' || r.address || '|' || r.business_hours || '|' || r.phone || '|' || r.line_url || '|' || r.booking_url || '|' || r.basic_price || '|' || r.price_90 || '|' || cardinality(r.gallery_asset_ids) from private.managed_shops s join private.managed_shop_revisions r on r.managed_shop_id=s.id and r.revision=s.current_revision where s.id=${quote(managedShopId)}::uuid;`);
  assert.equal(saved, "実接続の新規管理店舗|https://example.test/operator-official|大阪府大阪市テスト町1-2-3|10:00-翌2:00|06-9999-0000|https://line.me/R/test|https://example.test/operator-booking|12000|15000|1", "all editable fields and gallery selection must persist in the private draft");
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
  assert.ok(unlistedResponse && (unlistedResponse.status() === 200 || unlistedResponse.status() === 404), "unlisted managed shop must return a valid page response");
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
