import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import { chromium } from "@playwright/test";

const nextUrl = process.env.ESKOMI_E2E_NEXT_URL ?? "http://127.0.0.1:3000";
const entryHandle = process.env.ESKOMI_E2E_ENTRY_HANDLE;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.match(entryHandle ?? "", /^[0-9a-f-]{36}$/i, "ESKOMI_E2E_ENTRY_HANDLE must be a UUID");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required for the isolated fixture assertions");

const next = new URL(nextUrl);
const proxyState = { dropped: false, initialReceipt: null, idempotencyKey: null };

const proxy = createServer((clientRequest, clientResponse) => {
  const isFirstSubmit = !proxyState.dropped
    && clientRequest.method === "POST"
    && clientRequest.url === "/api/reviews/v2/submit/";
  const headers = { ...clientRequest.headers, host: next.host, origin: next.origin };
  const upstream = httpRequest({
    hostname: next.hostname,
    port: next.port || 80,
    path: clientRequest.url,
    method: clientRequest.method,
    headers,
  });
  upstream.on("error", (error) => clientResponse.destroy(error));
  clientRequest.pipe(upstream);
  upstream.on("response", (upstreamResponse) => {
    if (!isFirstSubmit) {
      clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(clientResponse);
      return;
    }
    const chunks = [];
    upstreamResponse.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    upstreamResponse.on("end", () => {
      proxyState.dropped = true;
      proxyState.idempotencyKey = String(clientRequest.headers["idempotency-key"] ?? "");
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      assert.equal(upstreamResponse.statusCode, 201, "the interrupted upstream response must follow a committed acceptance");
      assert.equal(payload.ok, true, "the interrupted upstream response must contain a successful acceptance");
      assert.match(payload.receipt ?? "", /^[A-Za-z0-9_-]{32,}$/);
      proxyState.initialReceipt = payload.receipt;
      // Do not forward either headers or body. This simulates a connection drop
      // after the server commits but before the browser receives its receipt.
      clientResponse.socket?.destroy();
    });
  });
});

const browserProxyOrigin = process.env.ESKOMI_E2E_BROWSER_PROXY_ORIGIN ?? "http://127.0.0.1";
await new Promise((resolve) => proxy.listen(0, browserProxyOrigin === "http://127.0.0.1" ? "127.0.0.1" : "0.0.0.0", resolve));
const proxyAddress = proxy.address();
assert.ok(proxyAddress && typeof proxyAddress !== "string");
const appUrl = `${browserProxyOrigin}:${proxyAddress.port}`;

function hmac(value) {
  return createHmac("sha256", serviceRoleKey).update(value).digest("hex");
}

async function apiRpc(name, body) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rpc/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      "Content-Profile": "api",
      "Accept-Profile": "api",
    },
    body: JSON.stringify(body),
  });
  assert.ok([200, 204].includes(response.status), `${name} must be callable in the isolated service-role fixture`);
  return response.status === 204 ? null : response.json();
}

function submission(entry) {
  return {
    entryHandle: entry,
    displayName: "再送E2E利用者",
    shopRating: 3,
    commonComment: "通信断後にも同じ受付結果と編集控えを安全に復元できることを確認する隔離環境専用のテスト投稿です。",
    therapistRating: null,
  };
}

async function waitForContext(page) {
  await page.getByRole("button", { name: "内容を確認する" }).waitFor({ state: "visible" });
  await expectEnabled(page.getByRole("button", { name: "内容を確認する" }));
}

async function expectEnabled(locator) {
  for (let index = 0; index < 40; index += 1) {
    if (await locator.isEnabled()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("review context did not become ready");
}

const browser = process.env.ESKOMI_E2E_CDP_URL
  ? await chromium.connectOverCDP(process.env.ESKOMI_E2E_CDP_URL)
  : await chromium.launch({
    headless: true,
    ...(process.env.ESKOMI_E2E_CHROMIUM ? { executablePath: process.env.ESKOMI_E2E_CHROMIUM } : {}),
  });
try {
  const context = process.env.ESKOMI_E2E_CDP_URL ? browser.contexts()[0] : await browser.newContext();
  assert.ok(context, "the connected Chromium browser must expose a default context");
  const page = await context.newPage();
  await page.goto(`${appUrl}/reviews/entry/${entryHandle}/`, { waitUntil: "networkidle" });
  const contextProbe = await page.evaluate(async (handle) => {
    const response = await fetch("/api/reviews/v2/context/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": "review-v2" },
      body: JSON.stringify({ entryHandle: handle, therapistAssignmentId: null }),
    });
    return { status: response.status, body: await response.json() };
  }, entryHandle);
  assert.equal(contextProbe.status, 200, `review context must be available: ${JSON.stringify(contextProbe.body)}`);
  await waitForContext(page);
  await page.getByLabel("利用体験コメント（任意）").fill(submission(entryHandle).commonComment);
  await page.getByRole("button", { name: "内容を確認する" }).click();
  await page.getByRole("button", { name: "受付する" }).click();
  await page.getByRole("button", { name: "受付する" }).waitFor({ state: "visible" });
  await page.getByText("fetch failed", { exact: false }).waitFor({ state: "visible" });
  assert.equal(proxyState.dropped, true, "the browser must lose the successful response");
  assert.match(proxyState.idempotencyKey ?? "", /^[0-9a-f-]{36}$/i);
  assert.match(proxyState.initialReceipt ?? "", /^[A-Za-z0-9_-]{32,}$/);

  await page.getByRole("button", { name: "受付する" }).click();
  const receiptMessage = page.getByText("編集控え：", { exact: false });
  await receiptMessage.waitFor({ state: "visible" });
  await assertReceipt(page, proxyState.initialReceipt);

  const guestCookie = (await context.cookies(appUrl)).find((cookie) => cookie.name === "eskomi_v11_guest");
  assert.ok(guestCookie?.httpOnly, "guest session must remain HttpOnly in the browser");
  const sessionHash = hmac(`guest|${guestCookie.value}`);
  const firstCounts = await apiRpc("eskomi_e2e_replay_counts", { p_session_hash: sessionHash });
  assert.deepEqual(firstCounts, [{ experience_count: 1, operation_count: 1, replay_count: 1 }], "same-session replay must not create a second experience or replay cache entry");

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto(`${appUrl}/reviews/entry/${entryHandle}/`, { waitUntil: "networkidle" });
  await waitForContext(otherPage);
  const otherResult = await otherPage.evaluate(async ({ key, payload }) => {
    const response = await fetch("/api/reviews/v2/submit/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": "review-v2", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    return { status: response.status, payload: await response.json() };
  }, { key: proxyState.idempotencyKey, payload: submission(entryHandle) });
  assert.equal(otherResult.status, 201, "a different guest scope may submit its own experience with the same key");
  assert.equal(otherResult.payload.replayed, false);
  assert.match(otherResult.payload.receipt ?? "", /^[A-Za-z0-9_-]{32,}$/);
  assert.notEqual(otherResult.payload.receipt, proxyState.initialReceipt, "a different guest session must never receive the first session's private receipt");
  await otherContext.close();

  await apiRpc("eskomi_e2e_expire_replay", { p_session_hash: sessionHash });
  const expiredResult = await page.evaluate(async ({ key, payload }) => {
    const response = await fetch("/api/reviews/v2/submit/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": "review-v2", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    return { status: response.status, payload: await response.json() };
  }, { key: proxyState.idempotencyKey, payload: submission(entryHandle) });
  assert.equal(expiredResult.status, 503, "expired replay must reject instead of generating a new receipt");
  assert.deepEqual(expiredResult.payload, { ok: false, code: "SUBMISSION_UNAVAILABLE" });
  const afterExpiryCounts = await apiRpc("eskomi_e2e_replay_counts", { p_session_hash: sessionHash });
  assert.deepEqual(afterExpiryCounts, [{ experience_count: 1, operation_count: 1, replay_count: 1 }], "expired replay must not create a replacement experience or receipt");

  console.log(JSON.stringify({
    status: "PASS",
    transport: "browser response dropped after committed server acceptance",
    sameSessionReplay: "one experience / one encrypted replay",
    otherSessionReceipt: "not disclosed",
    expiredReplay: "rejected without a replacement receipt",
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => proxy.close(resolve));
}

async function assertReceipt(page, receipt) {
  const text = await page.locator(".hl-contact-success").innerText();
  assert.ok(text.includes(receipt), "same-session replay must restore the original private receipt to the browser");
}
