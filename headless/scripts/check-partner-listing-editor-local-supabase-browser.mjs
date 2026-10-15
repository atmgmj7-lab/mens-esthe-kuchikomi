import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import http from "node:http";
import net from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

// This is deliberately separate from the in-process Supabase fixture QA. It
// creates disposable local Auth users and database rows, then uses the running
// local REST/Auth/Storage services through a real Next.js server.
const root = process.cwd();
const projectRoot = join(root, "..");
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const slug = `partner-e2e-${suffix}`;
const workspaceA = randomUUID();
const workspaceB = randomUUID();
const emailA = `partner-e2e-${suffix}-a@example.invalid`;
const emailB = `partner-e2e-${suffix}-b@example.invalid`;
const password = `E2e-${randomUUID()}-Aa1!`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLrLwAAAABJRU5ErkJggg==", "base64");

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const divider = line.indexOf("=");
    if (divider < 1) return [];
    const key = line.slice(0, divider);
    const raw = line.slice(divider + 1);
    return [[key, raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw]];
  }));
}

function localSupabaseEnv() {
  const raw = execFileSync("supabase", ["status", "-o", "env"], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const env = parseEnv(raw);
  for (const key of ["API_URL", "PUBLISHABLE_KEY", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`Local Supabase status did not provide ${key}. Start the isolated local Supabase stack first.`);
  }
  return env;
}

function localDatabaseContainer() {
  const projectId = readFileSync(join(projectRoot, "supabase/config.toml"), "utf8").match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!projectId) throw new Error("supabase/config.toml must define project_id.");
  const expected = `supabase_db_${projectId}`;
  const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).split("\n");
  if (!containers.includes(expected)) throw new Error(`Local Supabase database ${expected} is not running.`);
  return expected;
}

function psql(container, sql) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function quote(value) { return `'${value.replaceAll("'", "''")}'`; }
function stop(child) { return child.exitCode !== null ? Promise.resolve() : new Promise((resolve) => { child.kill("SIGTERM"); child.once("exit", resolve); }); }

async function expectOk(response, label) {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  return response.json();
}

const local = localSupabaseEnv();
const apiUrl = local.API_URL.replace(/\/$/, "");
const database = localDatabaseContainer();
const adminHeaders = { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const storageAdminHeaders = { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}` };
const publicHeaders = { apikey: local.PUBLISHABLE_KEY, "Content-Type": "application/json" };
const createdUsers = [];
let storeId = null;
let mock;
let next;
let browser;

async function createLocalUser(email) {
  const body = await expectOk(await fetch(`${apiUrl}/auth/v1/admin/users`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true }) }), "creating local Auth user");
  const id = body?.user?.id ?? body?.id;
  if (typeof id !== "string") throw new Error("Local Auth did not return a user id.");
  createdUsers.push(id);
  return id;
}

async function signIn(email) {
  const body = await expectOk(await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: publicHeaders, body: JSON.stringify({ email, password }) }), "signing in to local Auth");
  if (typeof body?.access_token !== "string") throw new Error("Local Auth did not return an access token.");
  return body.access_token;
}

function seed(userA, userB) {
  const uniqueWpSuffix = BigInt(`0x${suffix.slice(0, 10)}`);
  // The Partner session parser deliberately rejects unsafe JavaScript numbers.
  // Keep isolated WordPress IDs below Number.MAX_SAFE_INTEGER as production IDs are.
  const wpA = (8_100_000_000n + uniqueWpSuffix).toString();
  const wpB = (8_200_000_000n + uniqueWpSuffix).toString();
  psql(database, `
    insert into private.partner_workspaces (id, wp_shop_id, shop_slug, shop_name, canonical_url, state) values
      (${quote(workspaceA)}::uuid, ${wpA}::bigint, ${quote(slug)}, '実接続テスト店舗', ${quote(`https://mens-esthe-kuchikomi.com/shops/${slug}/`)}, 'active_partner'),
      (${quote(workspaceB)}::uuid, ${wpB}::bigint, ${quote(`other-${slug}`)}, '別店舗', ${quote(`https://mens-esthe-kuchikomi.com/shops/other-${slug}/`)}, 'active_partner');
    insert into private.partner_memberships (workspace_id, auth_user_id, role, status, accepted_at) values
      (${quote(workspaceA)}::uuid, ${quote(userA)}::uuid, 'owner', 'active', now()),
      (${quote(workspaceB)}::uuid, ${quote(userB)}::uuid, 'owner', 'active', now());
    select private.create_listing_store(${quote(slug)}, '実接続テスト店舗', '大阪市', 'https://example.invalid/', ${quote(workspaceA)}::uuid, null);
  `);
  storeId = psql(database, `select id from private.listing_stores where workspace_id=${quote(workspaceA)}::uuid;`);
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) throw new Error("Could not seed the local listing store.");
}

function assetRecord() {
  const row = psql(database, `select id || '|' || object_key from private.listing_application_assets where listing_store_id=${quote(storeId)}::uuid order by created_at desc limit 1;`);
  const [assetId, objectKey] = row.split("|");
  if (!/^[0-9a-f-]{36}$/i.test(assetId) || !objectKey?.startsWith(`listing-stores/${storeId}/`)) throw new Error("Partner banner was not persisted in the local database.");
  return { assetId, objectKey };
}

async function cleanup() {
  if (storeId) {
    const objectKeys = psql(database, `select name from storage.objects where bucket_id='listing-application-private' and name like ${quote(`listing-stores/${storeId}/%`)};`).split("\n").filter(Boolean);
    await Promise.all(objectKeys.map(async (objectKey) => {
      const response = await fetch(`${apiUrl}/storage/v1/object/listing-application-private/${objectKey}`, { method: "DELETE", headers: storageAdminHeaders });
      if (!response.ok && response.status !== 404) throw new Error(`Local Storage cleanup failed with HTTP ${response.status}.`);
    }));
    psql(database, `
    delete from private.listing_store_publications where listing_store_id=${quote(storeId)}::uuid;
    delete from private.listing_store_reviews where listing_store_id=${quote(storeId)}::uuid;
    delete from private.listing_store_revisions where listing_store_id=${quote(storeId)}::uuid;
    delete from private.listing_application_assets where listing_store_id=${quote(storeId)}::uuid;
    delete from private.partner_listing_banner_uploads where listing_store_id=${quote(storeId)}::uuid;
    delete from private.listing_stores where id=${quote(storeId)}::uuid;
  `);
  }
  psql(database, `
    delete from private.partner_login_email_audit_events where workspace_id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
    delete from private.partner_login_email_intents where workspace_id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
    delete from private.partner_review_campaigns where workspace_id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
    delete from private.partner_registration_submissions where workspace_id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
    delete from private.partner_memberships where workspace_id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
    delete from private.partner_state_history where workspace_id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
    delete from private.partner_workspaces where id in (${quote(workspaceA)}::uuid, ${quote(workspaceB)}::uuid);
  `);
}

try {
  const [userA, userB] = await Promise.all([createLocalUser(emailA), createLocalUser(emailB)]);
  console.log("local E2E: Auth users created");
  seed(userA, userB);
  console.log("local E2E: Partner fixture seeded");
  const [tokenA, tokenB] = await Promise.all([signIn(emailA), signIn(emailB)]);
  const mockPort = await freePort();
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  mock = http.createServer((request, response) => {
    if ((request.url ?? "").startsWith("/wp-json/wp/v2/shop")) { response.writeHead(200, { "Content-Type": "application/json" }); response.end("[]"); return; }
    if ((request.url ?? "").startsWith("/wp-json/wp/v2/area")) { response.writeHead(200, { "Content-Type": "application/json" }); response.end("[]"); return; }
    response.writeHead(404); response.end();
  });
  await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
  next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SUPABASE_URL: apiUrl, SUPABASE_AUTH_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY, DASHBOARD_BASIC_AUTH_USER: "operator", DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password", PARTNER_AUTH_REDIRECT_ORIGIN: baseUrl, WP_API_BASE_URL: `http://127.0.0.1:${mockPort}/wp-json` },
  });
  let log = "";
  next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-3000); });
  next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-3000); });
  for (let deadline = Date.now() + 30_000; ; await new Promise((resolve) => setTimeout(resolve, 200))) {
    if (next.exitCode !== null) throw new Error(`Local E2E Next server exited before ready: ${log}`);
    try { if ((await fetch(`${baseUrl}/partner/listing/`)).status === 200) break; } catch { /* waiting */ }
    if (Date.now() > deadline) throw new Error(`Local E2E Next server start timed out: ${log}`);
  }
  console.log("local E2E: Next server ready");
  const directAnonymousResponse = await fetch(`${baseUrl}/api/dashboard/partner-listing-revisions/`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(directAnonymousResponse.status, 401, "anonymous dashboard request must be rejected before browser navigation");
  console.log("local E2E: direct anonymous dashboard request denied");
  browser = await chromium.launch({ headless: true });
  console.log("local E2E: Chromium launched");
  const anonymous = await browser.newPage();
  console.log("local E2E: Chromium page created");
  const anonymousResponse = await anonymous.goto(`${baseUrl}/api/dashboard/partner-listing-revisions/`, { waitUntil: "domcontentloaded", timeout: 10_000 });
  assert.equal(anonymousResponse?.status(), 401, "anonymous operator API must be rejected");
  console.log("local E2E: anonymous dashboard request denied");
  const partner = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await partner.context().addCookies([{ name: "eskomi_partner_access_token", value: tokenA, domain: "127.0.0.1", path: "/" }]);
  await partner.goto(`${baseUrl}/partner/listing/`, { waitUntil: "domcontentloaded" });
  await partner.getByRole("heading", { name: "実接続テスト店舗" }).waitFor();
  console.log("local E2E: authenticated Partner editor loaded");
  const [uploadResponse] = await Promise.all([
    partner.waitForResponse((response) => response.url().endsWith("/api/partner/listing/banner/") && response.request().method() === "POST", { timeout: 10_000 }),
    partner.locator('input[type="file"]').setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png }),
  ]);
  assert.equal(uploadResponse.status(), 200, `partner banner upload failed: ${await uploadResponse.text()}`);
  await partner.getByText("画像を保管しました").waitFor({ timeout: 10_000 });
  const { assetId, objectKey } = assetRecord();
  const privateObject = await fetch(`${apiUrl}/storage/v1/object/listing-application-private/${objectKey}`, { headers: { apikey: local.PUBLISHABLE_KEY } });
  assert.notEqual(privateObject.status, 200, "private banner object must not be publicly readable");
  await partner.getByRole("button", { name: "下書きを保存" }).click();
  await partner.getByRole("button", { name: "変更を申請する" }).click();
  await partner.getByText("状態：承認待ち").waitFor();
  console.log("local E2E: draft and submission persisted");
  await partner.goto(`${baseUrl}/shops/${slug}/`, { waitUntil: "domcontentloaded" });
  assert.doesNotMatch(await partner.locator("body").innerText(), /実接続テスト店舗|承認前の紹介文/, "unapproved listing must not be public");
  assert.equal((await partner.goto(`${baseUrl}/api/partner/listing/banner/${assetId}/`))?.status(), 404, "unapproved banner must not be public");
  console.log("local E2E: unapproved listing and banner remain private");
  const operator = await browser.newPage();
  await operator.context().setHTTPCredentials({ username: "operator", password: "fixture-password" });
  await operator.goto(`${baseUrl}/dashboard/listing-applications/partner-revisions/`, { waitUntil: "domcontentloaded" });
  const operatorApi = await fetch(`${baseUrl}/api/dashboard/partner-listing-revisions/`, { headers: { Authorization: `Basic ${Buffer.from("operator:fixture-password").toString("base64")}` } });
  const operatorApiBody = await operatorApi.text();
  assert.equal(operatorApi.status, 200, `operator queue request failed: ${operatorApiBody}`);
  assert.match(operatorApiBody, new RegExp(slug), "operator queue must include the submitted local listing");
  await operator.locator("table").getByText("実接続テスト店舗").waitFor({ timeout: 10_000 });
  operator.once("dialog", (dialog) => dialog.accept("実接続テストの差し戻し理由"));
  await operator.getByRole("button", { name: "差し戻し" }).first().click();
  console.log("local E2E: operator return persisted");
  await partner.goto(`${baseUrl}/partner/listing/`, { waitUntil: "domcontentloaded" });
  await partner.getByText("実接続テストの差し戻し理由").waitFor();
  await partner.getByRole("textbox", { name: "紹介文" }).fill("実 Supabase を通じて修正・承認された紹介文");
  await partner.getByRole("button", { name: "下書きを保存" }).click();
  await partner.getByRole("button", { name: "変更を申請する" }).click();
  await operator.reload({ waitUntil: "domcontentloaded" });
  await operator.locator("table").getByText("実 Supabase を通じて修正・承認された紹介文").waitFor();
  operator.once("dialog", (dialog) => dialog.accept("実接続テスト承認"));
  await operator.getByRole("button", { name: "承認して公開" }).first().click();
  console.log("local E2E: resubmission approved");
  const publicPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  assert.equal((await publicPage.goto(`${baseUrl}/shops/${slug}/`, { waitUntil: "domcontentloaded" }))?.status(), 200);
  await publicPage.getByText("実 Supabase を通じて修正・承認された紹介文").waitFor();
  assert.equal((await publicPage.goto(`${baseUrl}/api/partner/listing/banner/${assetId}/`))?.status(), 200, "approved banner must be served through the public proxy");
  const other = await browser.newPage();
  await other.context().addCookies([{ name: "eskomi_partner_access_token", value: tokenB, domain: "127.0.0.1", path: "/" }]);
  await other.goto(`${baseUrl}/partner/listing/`);
  assert.equal(await other.evaluate(async () => (await fetch("/api/partner/listing/")).status), 403, "a Partner cannot edit another store");
  assert.equal(await operator.evaluate(async ({ staleStoreId }) => (await fetch("/api/dashboard/partner-listing-revisions/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: staleStoreId, revision: 2, decision: "approved" }) })).status, { staleStoreId: storeId }), 409, "stale operator approval must be rejected");
  await Promise.all([anonymous.close(), partner.close(), operator.close(), publicPage.close(), other.close()]);
  console.log("partner listing editor local Supabase browser E2E: PASS");
} finally {
  await browser?.close();
  await stop(next ?? { exitCode: 0 });
  await new Promise((resolve) => mock ? mock.close(resolve) : resolve());
  try { await cleanup(); } finally {
    await Promise.all(createdUsers.map(async (id) => { await fetch(`${apiUrl}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: adminHeaders }); }));
  }
}
