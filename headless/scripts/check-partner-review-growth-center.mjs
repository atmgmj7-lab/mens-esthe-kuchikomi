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
const tokenLine = "44444444-4444-4444-8444-444444444444";
const tokenWebsite = "55555555-5555-4555-8555-555555555555";
const identity = { workspaceId: workspaceA, shopId: 101, shopSlug: "shop-a", shopName: "Partner Shop A", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/", state: "free_official_partner" };
const campaign = (channel, token, isActive = true) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${token.slice(24)}`, channel, token, reviewUrl: `https://mens-esthe-kuchikomi.com/r/${token}/`, isActive, openCount: 2, startCount: 1, conversionCount: 1 });
const metrics = { workspaceId: workspaceA, shopId: 101, submittedReviews: 1, pendingReviews: 1, publicReviews: 0, campaigns: [campaign("counter_qr", tokenQr), campaign("line_after_visit", tokenLine), campaign("shop_website", tokenWebsite)] };

const ready = kit.resolvePartnerReviewGrowthCenter(identity, metrics);
assert.equal(ready.status, "allowed");
if (ready.status !== "allowed") throw new Error("expected own center");
assert.deepEqual(JSON.parse(JSON.stringify(ready.context)), { shopName: "Partner Shop A", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/" }, "center context must omit workspace, shop, campaign, and reviewer internals");
assert.deepEqual(JSON.parse(JSON.stringify(ready.assets.map((asset) => [asset.key, asset.status]))), [["review_url", "available"], ["qr", "available"], ["line", "available"], ["website_cta", "available"], ["widget", "available"]], "each rendered asset must come from its own active canonical campaign");
assert.equal(ready.assets.find((asset) => asset.key === "line")?.value.includes(tokenLine), true, "LINE must use only its intended campaign URL");
assert.equal(ready.assets.find((asset) => asset.key === "widget")?.value.includes(tokenWebsite), true, "Widget must use only its intended website campaign URL");
assert.doesNotMatch(JSON.stringify(ready), /workspaceId|shopId|campaignId|email|reviewBody|service.?role/i, "center projection must contain no private identifiers, PII, or authority");

const missing = kit.resolvePartnerReviewGrowthCenter(identity, { ...metrics, campaigns: [] });
if (missing.status !== "allowed") throw new Error("expected own missing-campaign center");
assert.equal(missing.assets.every((asset) => asset.status === "unavailable"), true, "missing campaign must be named unavailable, not fabricated as an asset");
assert.equal(missing.assets.every((asset) => !("value" in asset)), true, "unavailable cards must not render stale URLs");

const inactive = kit.resolvePartnerReviewGrowthCenter(identity, { ...metrics, campaigns: [campaign("counter_qr", tokenQr, false)] });
if (inactive.status !== "allowed") throw new Error("expected own inactive-campaign center");
assert.equal(inactive.assets[0].status, "unavailable", "inactive campaign must not be rendered as usable");

const duplicate = kit.resolvePartnerReviewGrowthCenter(identity, { ...metrics, campaigns: [campaign("counter_qr", tokenQr), campaign("counter_qr", "66666666-6666-4666-8666-666666666666")] });
if (duplicate.status !== "allowed") throw new Error("expected own duplicate-campaign center");
assert.equal(duplicate.assets[0].status, "misconfigured", "duplicate active campaign must be distinguishable from simple absence");
assert.equal("value" in duplicate.assets[0], false, "misconfigured campaign must never leak a stale URL");

assert.deepEqual(JSON.parse(JSON.stringify(kit.resolvePartnerReviewGrowthCenter({ ...identity, workspaceId: workspaceB }, metrics))), { status: "forbidden" }, "cross-workspace center projection must fail closed");
console.log("partner review Growth Center contract: PASS");
