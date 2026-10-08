import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const screenshotDir = process.env.RANKUP_OPERATOR_QA_SCREENSHOT_DIR;
const supabaseFactsMode = process.env.RANKUP_SUPABASE_MODE === "1";
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

function json(response, body, status = 200, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

function stop(child) {
  if (child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise((resolve) => child.once("exit", resolve));
}

async function noOverflow(page, name) {
  const dimensions = await page.locator("html").evaluate((node) => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width, `${name} must not overflow horizontally: ${JSON.stringify(dimensions)}`);
}

const wpPort = await freePort();
const supabasePort = await freePort();
const appPort = await freePort();
const certificateDir = mkdtempSync(join(tmpdir(), "eskomi-rankup-fixture-cert-"));
const certificate = join(certificateDir, "cert.pem");
const key = join(certificateDir, "key.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", certificate, "-subj", "/CN=127.0.0.1", "-days", "1"], { stdio: "ignore" });

const shop = {
  id: 768, type: "shop", status: "publish", date: "2026-10-07T00:00:00", modified: "2026-10-07T00:00:00",
  slug: "mrs-rank-up%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%a9%e3%83%b3%e3%82%af%e3%82%a2%e3%83%83%e3%83%97%ef%bc%89", link: "https://mens-esthe-kuchikomi.com/shops/mrs-rank-up%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%a9%e3%83%b3%e3%82%af%e3%82%a2%e3%83%83%e3%83%97%ef%bc%89/",
  title: { rendered: "Mrs.Rank UP（隔離fixture）" }, content: { rendered: "" }, excerpt: { rendered: "" }, area: [1],
  acf: {
    official_url: "https://fixture.example/rankup", basic_price: 12000, shop_hours: "10:00〜翌2:00", shop_address: "大阪市北区 fixture",
    shop_tel: "06-0000-0768", shop_line: "https://line.example/rankup", shop_booking: "Web予約", shop_holiday: "不定休", price_90: "15000", shop_booking_url: "https://reserve.example/rankup",
  },
  _embedded: { "wp:term": [[{ id: 1, count: 1, name: "梅田", slug: "umeda", parent: 0, taxonomy: "area" }]] },
};
const reviewIdPending = "11111111-1111-4111-8111-111111111111";
const reviewIdApproved = "22222222-2222-4222-8222-222222222222";
const unrelated = (index) => ({
  review_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`, wp_shop_id: 999, shop_slug: "other-shop", shop_name: "Other Shop",
  body: "unrelated fixture review", submitted_at: "2026-10-01T00:00:00Z", rating_total: 4, rating_price: 4, rating_service: 4, rating_cleanliness: 4,
  visit_period: null, revisit_intent: null, moderation_status: "pending", publication_status: "draft", is_public: false, nickname: "other",
});
const rankReview = (reviewId, moderationStatus, publicationStatus, body) => ({
  review_id: reviewId, wp_shop_id: 768, shop_slug: shop.slug, shop_name: shop.title.rendered, body, submitted_at: "2026-10-02T00:00:00Z",
  rating_total: 5, rating_price: 4, rating_service: 5, rating_cleanliness: 5, visit_period: "2026年10月", revisit_intent: "また利用したい",
  moderation_status: moderationStatus, publication_status: publicationStatus, is_public: false, nickname: "rank-fixture-user",
});
const moderationPages = [Array.from({ length: 100 }, (_, index) => unrelated(index + 1)), [
  rankReview(reviewIdPending, "pending", "draft", "Rank pending fixture review"),
  rankReview(reviewIdApproved, "approved", "draft", "Rank approved fixture review"),
]];
const requests = [];
const wpRequests = [];
let factSnapshot = null;
let forceNextFactConflict = false;

function factResponse(state) {
  if (!factSnapshot) return [];
  return [{ ...(state ? { state } : {}), ...factSnapshot }];
}

const wp = https.createServer({ key: readFileSync(key), cert: readFileSync(certificate) }, (request, response) => {
  const url = new URL(request.url ?? "/", `https://127.0.0.1:${wpPort}`);
  wpRequests.push({ method: request.method, path: url.pathname });
  if (url.pathname === "/wp-json/wp/v2/shop/768") return json(response, shop);
  if (url.pathname === "/wp-json/wp/v2/shop") return json(response, [shop], 200, { "X-WP-Total": "1", "X-WP-TotalPages": "1" });
  return json(response, { message: "not found" }, 404);
});
await new Promise((resolve) => wp.listen(wpPort, "127.0.0.1", resolve));

const supabase = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${supabasePort}`);
  let body = "";
  for await (const chunk of request) body += chunk;
  const payload = body ? JSON.parse(body) : {};
  requests.push({ method: request.method, path: url.pathname, payload });
  if (url.pathname === "/rest/v1/rpc/get_partner_shop_fact_snapshot") return json(response, factResponse());
  if (url.pathname === "/rest/v1/rpc/import_partner_shop_fact_snapshot") {
    if (!factSnapshot) factSnapshot = {
      wp_shop_id: shop.id, shop_slug: shop.slug, facts: payload.p_facts, revision: 1, updated_at: "2026-10-07T00:00:00.000Z",
    };
    return json(response, factResponse("imported"));
  }
  if (url.pathname === "/rest/v1/rpc/save_partner_shop_fact_snapshot") {
    if (!factSnapshot || payload.p_wp_shop_id !== shop.id) return json(response, { message: "missing snapshot" }, 400);
    if (forceNextFactConflict) {
      forceNextFactConflict = false;
      factSnapshot = {
        ...factSnapshot,
        facts: { ...factSnapshot.facts, price_90: "16500" },
        revision: factSnapshot.revision + 1,
        updated_at: "2026-10-07T00:02:00.000Z",
      };
      return json(response, factResponse("conflict"));
    }
    if (payload.p_expected_revision !== factSnapshot.revision) return json(response, factResponse("conflict"));
    const nextFacts = { ...factSnapshot.facts, ...payload.p_updates };
    if (JSON.stringify(nextFacts) === JSON.stringify(factSnapshot.facts)) return json(response, factResponse("noop"));
    factSnapshot = { ...factSnapshot, facts: nextFacts, revision: factSnapshot.revision + 1, updated_at: "2026-10-07T00:01:00.000Z" };
    return json(response, factResponse("saved"));
  }
  if (url.pathname === "/rest/v1/rpc/list_review_moderation_queue") {
    const offset = Number(payload.p_offset ?? 0);
    return json(response, moderationPages[offset / 100] ?? []);
  }
  if (url.pathname === "/rest/v1/rpc/list_partner_registration_reviews") return json(response, []);
  return json(response, []);
});
await new Promise((resolve) => supabase.listen(supabasePort, "127.0.0.1", resolve));

const baseUrl = `http://localhost:${appPort}`;
const next = spawn("npm", ["run", "dev", "--", "--hostname", "localhost", "--port", String(appPort)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    WP_API_BASE_URL: `https://127.0.0.1:${wpPort}/wp-json`,
    SUPABASE_URL: `http://127.0.0.1:${supabasePort}`,
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key",
    DASHBOARD_BASIC_AUTH_USER: "operator",
    DASHBOARD_BASIC_AUTH_PASSWORD: "fixture-password",
    ...(supabaseFactsMode ? { SHOP_MANAGEMENT_SOURCE: "supabase" } : {}),
  },
});
let log = "";
next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });
next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-4000); });

const browser = await chromium.launch({ headless: true });
try {
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`fixture server exited before ready\n${log}`);
    try {
      if ((await fetch(`${baseUrl}/dashboard/shops/768/edit/`)).status === 401) {
        ready = true;
        break;
      }
    } catch { /* wait */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(ready, true, `fixture server was not ready within 20 seconds\n${log}`);
  if (supabaseFactsMode) {
    const probeOptions = {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from("operator:fixture-password").toString("base64")}`,
        "Content-Type": "application/json", "X-ESKOMI-CSRF": "official-facts-write",
        Origin: baseUrl, "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify({ updates: { basic_price: "13000" }, expectedRevision: 1 }),
    };
    const probe = await fetch(`${baseUrl}/api/dashboard/shops/768/official-facts/`, probeOptions);
    assert.equal(probe.status, 503, "source route must fail safely before a snapshot is imported");
    const otherShopProbe = await fetch(`${baseUrl}/api/dashboard/shops/769/official-facts/`, probeOptions);
    assert.equal(otherShopProbe.status, 404, "the WP768-only source route must reject another shop");
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    if (supabaseFactsMode) factSnapshot = null;
    const context = await browser.newContext({ viewport, httpCredentials: { username: "operator", password: "fixture-password" } });
    const edit = await context.newPage();
    edit.setDefaultTimeout(8_000);
    await edit.goto(`${baseUrl}/dashboard/shops/768/edit/`, { waitUntil: "domcontentloaded" });
    await edit.getByRole("heading", { name: "公開情報を確認・修正候補にする" }).waitFor({ state: "visible" });
    assert.equal(await edit.locator('input[name="basic_price"][value="12000"]').count(), 1, "fixture edit screen must read the existing basic price");
    await edit.getByRole("button", { name: /変更候補を確認する/ }).click();
    await edit.getByRole("status").getByText(/変更はありません/).waitFor({ state: "visible" });
    if (supabaseFactsMode) {
      await edit.locator('input[name="price_90"]').fill("16000");
      await edit.getByRole("button", { name: /変更候補を確認する/ }).click();
      await edit.getByText("基本料金").last().waitFor({ state: "visible" });
      await edit.getByLabel("差分と保存先を確認しました。").check();
      await edit.getByRole("button", { name: "Supabaseへ保存して再読込" }).click();
      await edit.getByText("Supabaseの検証用正本へ保存し、再読込用snapshotを取得しました。").waitFor({ state: "visible" });
      await edit.reload({ waitUntil: "domcontentloaded" });
      assert.equal(await edit.locator('input[name="price_90"]').inputValue(), "16000", "Supabase save must be reloaded into the edit form");
      await edit.getByText(/revision 2/).waitFor({ state: "visible" });
      const publicPage = await context.newPage();
      publicPage.setDefaultTimeout(8_000);
      await publicPage.goto(`${baseUrl}/shops/${shop.slug}/`, { waitUntil: "domcontentloaded" });
      await publicPage.getByText("16,000円〜").waitFor({ state: "visible" });
      await publicPage.close();
      await edit.locator('input[name="price_90"]').fill("17000");
      await edit.getByRole("button", { name: /変更候補を確認する/ }).click();
      await edit.getByLabel("差分と保存先を確認しました。").check();
      forceNextFactConflict = true;
      await edit.getByRole("button", { name: "Supabaseへ保存して再読込" }).click();
      await edit.getByText("店舗情報が更新されています。再読込して差分を確認してください。").waitFor({ state: "visible" });
      assert.equal(await edit.locator('input[name="price_90"]').inputValue(), "16500", "conflict response must replace the stale browser value");
      await edit.getByText(/revision 3/).waitFor({ state: "visible" });
    }
    await noOverflow(edit, `${viewport.width}px Rank edit`);
    if (screenshotDir) await edit.screenshot({ path: `${screenshotDir}/rankup-edit-${viewport.width}.png`, fullPage: true });

    const moderation = await context.newPage();
    await moderation.goto(`${baseUrl}/dashboard/partners/`, { waitUntil: "domcontentloaded" });
    await moderation.getByRole("heading", { name: "口コミ審査キュー" }).waitFor({ state: "visible" });
    await moderation.getByText("Rank pending fixture review").waitFor({ state: "visible" });
    assert.equal(await moderation.getByText("unrelated fixture review").count(), 0, "only Rank reviews may reach the browser");
    await moderation.getByLabel("状態").selectOption("approved_ready");
    await moderation.getByText("Rank approved fixture review").waitFor({ state: "visible" });
    assert.equal(await moderation.getByText("Rank pending fixture review").count(), 0, "status filter must isolate approved/draft records");
    await noOverflow(moderation, `${viewport.width}px Rank moderation`);
    if (screenshotDir) await moderation.screenshot({ path: `${screenshotDir}/rankup-moderation-${viewport.width}.png`, fullPage: true });
    await edit.close();
    await moderation.close();
    await context.close();
  }
  const pageOffsets = requests.filter((request) => request.path.endsWith("list_review_moderation_queue")).map((request) => request.payload.p_offset);
  assert.ok(pageOffsets.includes(0) && pageOffsets.includes(100), `Rank queue must continue past unrelated first page: ${JSON.stringify(pageOffsets)}`);
  assert.equal(requests.some((request) => /moderate_review|publish_review/.test(request.path)), false, "fixture UI must not perform moderation or publication writes");
  if (supabaseFactsMode) assert.equal(requests.filter((request) => request.path.endsWith("save_partner_shop_fact_snapshot")).length, 5, "the route probe and each viewport must verify save plus conflict");
  assert.equal(wpRequests.every((request) => request.method === "GET"), true, "fixture edit dry-runs must read WordPress only");
  console.log(`Rank UP operator fixture browser QA (${supabaseFactsMode ? "Supabase-primary" : "WordPress-read-only"}): PASS`);
} finally {
  await browser.close();
  await stop(next);
  await new Promise((resolve) => supabase.close(resolve));
  await new Promise((resolve) => wp.close(resolve));
}
