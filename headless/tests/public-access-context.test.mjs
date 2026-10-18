import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ESKOMI_ACCESS_CONTEXT_SECRET = "isolated-public-access-context-test-secret";
const context = await import("../lib/analytics/public-access-context.ts");

const atJst = (iso) => new Date(iso);

test("public access contexts use a short expiry up to the next JST midnight", () => {
  const cases = [
    ["22:59", atJst("2026-10-17T13:59:00.000Z"), "2026-10-17T14:29:00.000Z"],
    ["23:00", atJst("2026-10-17T14:00:00.000Z"), "2026-10-17T14:30:00.000Z"],
    ["23:59", atJst("2026-10-17T14:59:00.000Z"), "2026-10-17T15:00:00.000Z"],
    ["00:00", atJst("2026-10-17T15:00:00.000Z"), "2026-10-17T15:30:00.000Z"],
  ];
  for (const [label, now, expected] of cases) {
    assert.equal(context.publicAccessContextExpiresAt(now), Math.floor(new Date(expected).getTime() / 1000), label);
  }
});

test("independently minted first sessions keep both concurrent contexts valid", () => {
  const now = atJst("2026-10-17T14:30:00.000Z");
  const first = context.resolvePublicAccessContextSession(undefined, now);
  const second = context.resolvePublicAccessContextSession(undefined, now);
  assert.ok(first?.isNew && second?.isNew);
  assert.notEqual(first.sessionHash, second.sessionHash);
  const view = context.issuePublicAccessContext({ shopSlug: "fixture-shop", eventKind: "shop_view", sessionHash: first.sessionHash, now });
  const click = context.issuePublicAccessContext({ shopSlug: "fixture-shop", eventKind: "official_line_click", sessionHash: second.sessionHash, now });
  assert.ok(context.verifyPublicAccessContext({ context: view, shopSlug: "fixture-shop", eventKind: "shop_view", now }));
  assert.ok(context.verifyPublicAccessContext({ context: click, shopSlug: "fixture-shop", eventKind: "official_line_click", now }));
  assert.equal(context.resolvePublicAccessContextSession(`${first.cookieValue}tampered`, now)?.isNew, true);
});

test("refreshed context dedupes each event kind without dropping the first LINE click", () => {
  const firstNow = atJst("2026-10-17T12:00:00.000Z");
  const laterNow = atJst("2026-10-17T12:00:01.000Z");
  const session = context.resolvePublicAccessContextSession(undefined, firstNow);
  const viewOne = context.issuePublicAccessContext({ shopSlug: "fixture-shop", eventKind: "shop_view", sessionHash: session.sessionHash, now: firstNow });
  const viewTwo = context.issuePublicAccessContext({ shopSlug: "fixture-shop", eventKind: "shop_view", sessionHash: session.sessionHash, now: laterNow });
  const line = context.issuePublicAccessContext({ shopSlug: "fixture-shop", eventKind: "official_line_click", sessionHash: session.sessionHash, now: laterNow });
  const firstView = context.verifyPublicAccessContext({ context: viewOne, shopSlug: "fixture-shop", eventKind: "shop_view", now: firstNow });
  const refreshedView = context.verifyPublicAccessContext({ context: viewTwo, shopSlug: "fixture-shop", eventKind: "shop_view", now: laterNow });
  const firstLine = context.verifyPublicAccessContext({ context: line, shopSlug: "fixture-shop", eventKind: "official_line_click", now: laterNow });
  assert.equal(firstView.accessContextHash, refreshedView.accessContextHash);
  assert.notEqual(firstView.accessContextHash, firstLine.accessContextHash);
  assert.equal(firstView.sessionScopeHash, firstLine.sessionScopeHash);
});

test("network signal is only accepted from the trusted hosting proxy and stores no raw address", () => {
  const prior = process.env.VERCEL;
  process.env.VERCEL = "1";
  const value = context.publicAccessNetworkScopeHash("203.0.113.14, 10.0.0.1");
  assert.match(value ?? "", /^[0-9a-f]{64}$/);
  assert.equal(value?.includes("203.0.113.14"), false);
  process.env.VERCEL = "0";
  assert.equal(context.publicAccessNetworkScopeHash("203.0.113.14"), null);
  process.env.VERCEL = prior;
});
