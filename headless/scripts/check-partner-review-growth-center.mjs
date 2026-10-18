import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const kitPath = join(root, "lib/partner/partner-review-growth-kit.ts");

function loadModule(source, filename) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === "server-only") return {};
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
  });
  return module.exports;
}

const kit = loadModule(readFileSync(kitPath, "utf8"), kitPath);
assert.equal(typeof kit.resolvePartnerReviewGrowthCenter, "function", "GROWTH-02 must expose a server-derived center projection instead of trusting browser-selected assets");

const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const tokenQr = "33333333-3333-4333-8333-333333333333";
const tokenWidget = "55555555-5555-4555-8555-555555555555";
const identity = { workspaceId: workspaceA, appShopId: "77777777-7777-4777-8777-777777777777", shopSlug: "shop-a", shopName: "Partner Shop A", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/", state: "free_official_partner" };
const metrics = { workspaceId: workspaceA, appShopId: identity.appShopId, reviewHandle: tokenQr, widgetHandle: tokenWidget, submittedReviews: 1, pendingReviews: 1, publicReviews: 0 };

const ready = kit.resolvePartnerReviewGrowthCenter(identity, metrics);
assert.equal(ready.status, "allowed");
if (ready.status !== "allowed") throw new Error("expected own center");
assert.deepEqual(JSON.parse(JSON.stringify(ready.context)), { shopName: "Partner Shop A", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/" }, "center context must omit workspace, shop, campaign, and reviewer internals");
assert.deepEqual(JSON.parse(JSON.stringify(ready.assets.map((asset) => [asset.key, asset.status]))), [["review_url", "available"], ["qr", "available"], ["line", "available"], ["website_cta", "available"], ["widget", "available"]], "each rendered asset must come from the canonical app-shop handles");
assert.equal(ready.assets.find((asset) => asset.key === "line")?.value.includes(tokenQr), true, "LINE must use the canonical app-shop review URL");
assert.equal(ready.assets.find((asset) => asset.key === "widget")?.value.includes(tokenWidget), true, "Widget must use the canonical widget handle");
assert.doesNotMatch(JSON.stringify(ready), /workspaceId|appShopId|campaignId|email|reviewBody|service.?role/i, "center projection must contain no private identifiers, PII, or authority");

const missing = kit.resolvePartnerReviewGrowthCenter(identity, null);
if (missing.status !== "allowed") throw new Error("expected own unavailable center");
assert.equal(missing.assets.every((asset) => asset.status === "unavailable"), true, "unavailable canonical growth must not be fabricated as an asset");
assert.equal(missing.assets.every((asset) => !("value" in asset)), true, "unavailable cards must not render stale URLs");

const invalid = kit.resolvePartnerReviewGrowthCenter(identity, { ...metrics, reviewHandle: "not-a-handle" });
if (invalid.status !== "allowed") throw new Error("expected own invalid-handle center");
assert.equal(invalid.assets[0].status, "misconfigured", "invalid canonical handles must not be rendered as usable");
assert.equal("value" in invalid.assets[0], false, "misconfigured handle must never leak a stale URL");

assert.deepEqual(JSON.parse(JSON.stringify(kit.resolvePartnerReviewGrowthCenter({ ...identity, workspaceId: workspaceB }, metrics))), { status: "forbidden" }, "cross-workspace center projection must fail closed");
console.log("partner review Growth Center contract: PASS");
