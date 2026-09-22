import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const dashboardPath = join(root, "lib/partner/partner-dashboard.ts");
function load(source, filename) {
  const output = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: (specifier) => specifier === "server-only" ? {} : (() => { throw new Error(`Unexpected dependency: ${specifier}`); })() });
  return module.exports;
}
const dashboard = load(readFileSync(dashboardPath, "utf8"), dashboardPath);
assert.equal(typeof dashboard.resolvePartnerGuidedOnboarding, "function", "GROWTH-06 must project an onboarding checklist from authorized existing state without creating provisioning side effects");

const identity = { workspaceId: "11111111-1111-4111-8111-111111111111", shopId: 101, shopSlug: "shop-a", shopName: "Partner Shop A", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/", state: "free_official_partner" };
const available = { status: "allowed", reviewUrl: { status: "available", value: "https://mens-esthe-kuchikomi.com/r/33333333-3333-4333-8333-333333333333/" }, qr: { status: "available", value: "https://mens-esthe-kuchikomi.com/r/33333333-3333-4333-8333-333333333333/" }, lineMessage: { status: "available", value: "neutral" }, websiteCta: { status: "available", value: "<a>neutral</a>" }, widgetUrl: { status: "available", value: "https://mens-esthe-kuchikomi.com/partner/widget/33333333-3333-4333-8333-333333333333/" }, reviewMetrics: { status: "available", submitted: 1, pending: 1, published: 0 }, campaignMetrics: { status: "unavailable" } };

const firstRun = dashboard.resolvePartnerGuidedOnboarding(identity, { ...available, reviewMetrics: { status: "available", submitted: 0, pending: 0, published: 0 } });
assert.equal(firstRun.status, "allowed");
if (firstRun.status !== "allowed") throw new Error("expected allowed first run");
assert.equal(firstRun.kind, "first_run", "zero real reviews with available assets must guide the first review, not pretend completion");
assert.deepEqual(JSON.parse(JSON.stringify(firstRun.context)), { shopName: "Partner Shop A", canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/" }, "onboarding must expose only canonical shop context");
assert.deepEqual(JSON.parse(JSON.stringify(firstRun.steps.map((step) => step.status))), ["complete", "complete", "ready", "ready"], "completed onboarding steps must derive from existing identity and available assets, not fake progress");

const completed = dashboard.resolvePartnerGuidedOnboarding(identity, available);
assert.equal(completed.status, "allowed");
if (completed.status !== "allowed") throw new Error("expected completed onboarding");
assert.equal(completed.kind, "guided", "an existing submitted review must produce guidance-complete state without inventing a lifecycle transition");

const unavailable = dashboard.resolvePartnerGuidedOnboarding(identity, { ...available, reviewUrl: { status: "unavailable" }, qr: { status: "unavailable" }, lineMessage: { status: "unavailable" }, websiteCta: { status: "unavailable" }, widgetUrl: { status: "unavailable" }, reviewMetrics: { status: "unavailable" } });
assert.equal(unavailable.status, "allowed");
if (unavailable.status !== "allowed") throw new Error("expected unavailable onboarding");
assert.equal(unavailable.kind, "assets_unavailable", "technical unavailability must be distinct from an incomplete checklist");
assert.equal(unavailable.steps.some((step) => step.status === "unavailable"), true);
assert.deepEqual(JSON.parse(JSON.stringify(dashboard.resolvePartnerGuidedOnboarding({ ...identity, state: "normal_listing" }, available))), { status: "forbidden" }, "ineligible workspace state must receive no onboarding assets");
assert.doesNotMatch(JSON.stringify(firstRun), /workspaceId|shopId|shopSlug|token|email|wordpress|campaignId/i, "onboarding projection must not require WordPress re-entry or expose private identifiers");
console.log("partner guided onboarding contract: PASS");
