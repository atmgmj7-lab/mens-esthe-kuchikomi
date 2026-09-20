import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const fixtureShop = { id: 701, slug: "fixture-shop", title: "検証店舗", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/fixture-shop/" };
const fixtureToken = "11111111-1111-4111-8111-111111111111";

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  }
}

function loadTypeScript(relativePath, modules) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: relativePath }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in modules) return modules[specifier];
    throw new Error(`Unexpected module in ${relativePath}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const validation = loadTypeScript("lib/review-validation.ts", {});
let directWordPressResult = { ok: true, id: 9981 };
let directWordPressCalls = 0;
const directConversionCalls = [];
const reviewApi = loadTypeScript("app/api/reviews/submit/route.ts", {
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/review-rate-limit": { checkReviewRateLimit: () => ({ allowed: true, retryAfterSec: 0 }) },
  "@/lib/review-validation": validation,
  "@/lib/partner/provisioning-service": {
    openPartnerReviewCampaign: async (token) => token === fixtureToken ? fixtureShop : null,
    recordPartnerReviewCampaignSubmission: async (input) => { directConversionCalls.push(input); return true; },
  },
  "@/lib/supabase/partner-workspace": { partnerReviewGrowthRepository: {} },
  "@/lib/wp/review-submit": { submitReviewToWordPress: async () => { directWordPressCalls += 1; return directWordPressResult; } },
  "@/lib/wp/shops": { getShopBySlug: async (slug) => slug === fixtureShop.slug
    ? { ...fixtureShop, publicationStatus: "publish" }
    : slug === "other-shop" ? { ...fixtureShop, id: 702, slug, publicationStatus: "publish" } : null },
});

const reviewPayload = { shopSlug: fixtureShop.slug, nickname: "投稿者", usedPeriod: "今月", ratingTotal: 5, reviewBody: "これは30文字以上ある口コミ本文です。キャンペーン送信の検証に使用します。", website: "" };
async function submitDirect(payload) {
  return reviewApi.POST({ headers: new Headers({ "x-forwarded-for": "198.51.100.10" }), json: async () => payload });
}

directWordPressCalls = 0;
directConversionCalls.length = 0;
directWordPressResult = { ok: true, id: 9981 };
let response = await submitDirect({ ...reviewPayload, campaignToken: fixtureToken });
assert.equal(response.status, 200);
assert.equal(directWordPressCalls, 1);
assert.deepEqual(directConversionCalls, [{ token: fixtureToken, shopId: fixtureShop.id, wordpressReviewId: 9981 }]);
directWordPressCalls = 0;
directConversionCalls.length = 0;
directWordPressResult = { ok: false, error: "WordPress unavailable" };
response = await submitDirect({ ...reviewPayload, campaignToken: fixtureToken });
assert.equal(response.status, 503);
assert.equal(directWordPressCalls, 1);
assert.equal(directConversionCalls.length, 0, "failed WordPress submission has no conversion");

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}
async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); } });
    request.on("error", reject);
  });
}
function wpShop(id, slug) {
  return { id, type: "shop", status: "publish", date: "2026-09-20T00:00:00", modified: "2026-09-20T00:00:00", slug, link: `https://mens-esthe-kuchikomi.com/shops/${slug}/`, title: { rendered: slug === fixtureShop.slug ? fixtureShop.title : "別店舗" }, content: { rendered: "" }, excerpt: { rendered: "" }, featured_media: 0, acf: {}, _embedded: { "wp:term": [] } };
}
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}
async function stopNext(child) {
  if (!child || child.exitCode !== null) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) {
    try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  }
}

const privateEvents = [];
const wordpressPosts = [];
const supabase = createServer(async (request, reply) => {
  const body = await readJson(request);
  if (request.url === "/rest/v1/rpc/open_partner_review_campaign") {
    const active = body.p_token === fixtureToken;
    reply.writeHead(200, { "Content-Type": "application/json" });
    reply.end(JSON.stringify(active ? [{ wp_shop_id: fixtureShop.id, shop_slug: fixtureShop.slug, shop_name: fixtureShop.title, canonical_url: fixtureShop.canonicalUrl }] : []));
    return;
  }
  if (request.url === "/rest/v1/rpc/record_partner_review_campaign_submission") {
    privateEvents.push(body);
    reply.writeHead(200, { "Content-Type": "application/json" });
    reply.end("true");
    return;
  }
  reply.writeHead(404).end();
});

const certDir = mkdtempSync(join(tmpdir(), "partner-review-growth-"));
const keyPath = join(certDir, "localhost-key.pem");
const certPath = join(certDir, "localhost-cert.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-days", "1"], { stdio: "ignore" });
const wordpress = createHttpsServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, async (request, reply) => {
  const url = new URL(request.url ?? "/", `https://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/wp-json/wp/v2/shop") {
    const slug = url.searchParams.get("slug");
    const shop = slug === fixtureShop.slug ? wpShop(fixtureShop.id, slug) : slug === "other-shop" ? wpShop(702, slug) : null;
    reply.writeHead(200, { "Content-Type": "application/json", "X-WP-Total": shop ? "1" : "0", "X-WP-TotalPages": "1" });
    reply.end(JSON.stringify(shop ? [shop] : []));
    return;
  }
  if (request.method === "POST" && url.pathname === "/wp-json/wp/v2/reviews") {
    wordpressPosts.push(await readJson(request));
    reply.writeHead(201, { "Content-Type": "application/json" });
    reply.end(JSON.stringify({ id: 9100 + wordpressPosts.length }));
    return;
  }
  reply.writeHead(404).end();
});

const supabasePort = await listen(supabase);
const wordpressPort = await listen(wordpress);
const appPort = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1", () => { const address = probe.address(); probe.close(() => resolve(address.port)); });
});
assert.equal(await isPortOpen(appPort), false, "QA app port must be unused");
const baseUrl = `http://127.0.0.1:${appPort}`;
const next = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: root,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${supabasePort}`, SUPABASE_SERVICE_ROLE_KEY: "partner-review-growth-local-test", WP_API_BASE_URL: `https://localhost:${wordpressPort}/wp-json`, WP_REVIEW_SUBMIT_USER: "local-test", WP_REVIEW_SUBMIT_APP_PASSWORD: "local-test", REVIEW_SUBMIT_DRY_RUN: "false", NODE_EXTRA_CA_CERTS: certPath },
});
let nextLog = "";
next.stdout.on("data", (chunk) => { nextLog = `${nextLog}${chunk}`.slice(-4000); });
next.stderr.on("data", (chunk) => { nextLog = `${nextLog}${chunk}`.slice(-4000); });

const browser = await chromium.launch({ headless: true });
try {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Next server exited before ready\n${nextLog}`);
    try { if ((await fetch(`${baseUrl}/r/invalid-token/`)).status === 404) break; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(await isPortOpen(appPort), true, `Next server did not become ready\n${nextLog}`);
  const invalid = await fetch(`${baseUrl}/r/invalid-token/`, { redirect: "manual" });
  assert.equal(invalid.status, 404);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
  assert.equal(invalid.headers.get("x-robots-tag"), "noindex, nofollow");

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/r/${fixtureToken}/`, { waitUntil: "domcontentloaded" });
  assert.equal(new URL(page.url()).pathname, "/reviews/submit/");
  assert.equal(new URL(page.url()).search, `?shop=${fixtureShop.slug}&campaign=${fixtureToken}`);
  const campaignForm = page.locator("form.hl-review-form");
  await campaignForm.waitFor({ state: "visible" });
  assert.match(await campaignForm.innerText(), new RegExp(fixtureShop.title));
  await page.locator("#review-nickname").fill("投稿者");
  await page.locator("#review-used-period").selectOption("今月");
  await page.locator("#review-rating-total").selectOption("5");
  await page.locator("#review-body").fill(reviewPayload.reviewBody);
  await page.locator(".hl-contact-submit").click();
  await page.locator(".hl-contact-success").waitFor({ state: "visible" });
  assert.equal(wordpressPosts.length, 1);
  assert.equal(wordpressPosts[0].status, "pending");
  assert.equal(wordpressPosts[0].meta.review_shop_id, fixtureShop.id);
  assert.deepEqual(privateEvents, [{ p_token: fixtureToken, p_wp_shop_id: fixtureShop.id, p_wp_review_id: 9101 }], "the real client form carries only the campaign token to attribution");

  await page.goto(`${baseUrl}/reviews/submit/?shop=${fixtureShop.slug}`, { waitUntil: "domcontentloaded" });
  await page.locator("form.hl-review-form").waitFor({ state: "visible" });
  await page.locator("#review-nickname").fill("通常投稿者");
  await page.locator("#review-used-period").selectOption("今月");
  await page.locator("#review-rating-total").selectOption("5");
  await page.locator("#review-body").fill(reviewPayload.reviewBody);
  await page.locator(".hl-contact-submit").click();
  await page.locator(".hl-contact-success").waitFor({ state: "visible" });
  assert.equal(wordpressPosts.length, 2, "normal form path still submits");
  assert.equal(privateEvents.length, 1, "normal form path has no attribution");

  await page.goto(`${baseUrl}/reviews/submit/?shop=other-shop&campaign=${fixtureToken}`, { waitUntil: "domcontentloaded" });
  await page.getByText("キャンペーンの投稿先店舗を確認できません。", { exact: true }).waitFor({ state: "visible" });
  assert.equal(await page.locator("form.hl-review-form").count(), 0, "mismatched campaign/shop does not render a form");
  const mismatch = await page.evaluate(async ({ token, payload }) => {
    const response = await fetch("/api/reviews/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, shopSlug: "other-shop", campaignToken: token }) });
    return response.status;
  }, { token: fixtureToken, payload: reviewPayload });
  assert.equal(mismatch, 400);
  assert.equal(wordpressPosts.length, 2, "mismatched API request never reaches mocked WordPress");
  await page.close();
  console.log("partner review growth changed-flow headless browser QA passed");
} finally {
  await browser.close();
  await stopNext(next);
  await close(supabase);
  await close(wordpress);
  rmSync(certDir, { recursive: true, force: true });
}
