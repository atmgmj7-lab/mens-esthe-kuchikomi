import assert from "node:assert/strict";
import { test } from "node:test";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const { createAnalyticsCurrentHandler } = await import("../../app/api/dashboard/analytics/current/route.ts");

const snapshot = { schemaVersion: "1.0.0", timezone: "Asia/Tokyo", sources: { ga4: { state: "partial" } } };
const request = (suffix = "") => new Request(`https://test.invalid/api/dashboard/analytics/current${suffix}`);

test("analytics API authorizes before parsing or collecting and makes every response private/noindex", async () => {
  let calls = 0;
  const handler = createAnalyticsCurrentHandler({
    authorize: () => ({ ok: false, status: 401, reason: "missing-credentials" }),
    collect: async () => { calls += 1; return snapshot; },
  });
  const response = await handler(request("?period=anything"));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
  assert.match(response.headers.get("cache-control"), /private.*no-store/i);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(JSON.stringify(await response.json()).includes("missing-credentials"), false);
});

test("analytics API maps missing configuration to 503 before collection with the same protected headers", async () => {
  let calls = 0;
  const handler = createAnalyticsCurrentHandler({
    authorize: () => ({ ok: false, status: 503, reason: "missing-configuration" }),
    collect: async () => { calls += 1; return snapshot; },
  });
  const response = await handler(request("?period=7"));
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
  assert.match(response.headers.get("cache-control"), /private.*no-store/i);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("analytics API accepts only one 7/28 period after auth and returns a partial snapshot unchanged", async () => {
  const periods = [];
  const handler = createAnalyticsCurrentHandler({
    authorize: () => ({ ok: true, status: 200, reason: "authorized" }),
    collect: async ({ days }) => { periods.push(days); return snapshot; },
  });
  for (const suffix of ["", "?period=14", "?period=7&period=28", "?period=7&x=1"]) {
    const response = await handler(request(suffix));
    assert.equal(response.status, 400, suffix);
  }
  const response = await handler(request("?period=28"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), snapshot);
  assert.deepEqual(periods, [28]);
});

test("analytics API sanitizes a post-auth collector failure with protected headers", async () => {
  const handler = createAnalyticsCurrentHandler({
    authorize: () => ({ ok: true, status: 200, reason: "authorized" }),
    collect: async () => { throw new Error("source error must not leak"); },
  });
  const response = await handler(request("?period=7"));
  assert.equal(response.status, 500);
  assert.match(response.headers.get("cache-control"), /private.*no-store/i);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(JSON.stringify(await response.json()).includes("source error"), false);
});
