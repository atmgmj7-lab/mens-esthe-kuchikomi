import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

const kit = existsSync(kitPath) ? loadModule(readFileSync(kitPath, "utf8"), kitPath) : {};
assert.equal(
  typeof kit.resolvePartnerReviewGrowthKit,
  "function",
  "03C must expose a server-derived Growth Kit resolver that can reject cross-workspace metrics before rendering",
);

const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const tokenQr = "33333333-3333-4333-8333-333333333333";
const tokenWidget = "55555555-5555-4555-8555-555555555555";

const identityA = {
  workspaceId: workspaceA,
  appShopId: "77777777-7777-4777-8777-777777777777",
  shopSlug: "shop-a",
  shopName: "Partner Shop A",
  canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
  state: "free_official_partner",
};

const metricsA = {
  workspaceId: workspaceA,
  appShopId: identityA.appShopId,
  reviewHandle: tokenQr,
  widgetHandle: tokenWidget,
  submittedReviews: 8,
  pendingReviews: 2,
  publicReviews: 5,
};

const allowed = kit.resolvePartnerReviewGrowthKit(identityA, metricsA);
assert.equal(allowed.status, "allowed", "an authorized partner must receive its own existing Phase 2 metrics only");
if (allowed.status !== "allowed") throw new Error("expected own workspace Growth Kit");
assert.equal(allowed.reviewUrl.status, "available");
assert.equal(allowed.reviewUrl.value, `https://mens-esthe-kuchikomi.com/r/${tokenQr}/`, "the primary review URL must be the canonical counter QR URL");
assert.equal(allowed.qr.status, "available");
assert.equal(allowed.qr.value, `https://mens-esthe-kuchikomi.com/r/${tokenQr}/`, "the QR input must be the server-derived canonical review URL only");
assert.equal(allowed.lineMessage.status, "available");
if (allowed.lineMessage.status !== "available") throw new Error("expected LINE message");
assert.match(allowed.lineMessage.value, new RegExp(tokenQr), "the neutral LINE message must use the canonical app-shop review URL");
assert.doesNotMatch(allowed.lineMessage.value, /★|5つ星|高評価|良い口コミだけ|特典|報酬/i, "the LINE message must not solicit only positive ratings or rewards");
assert.equal(allowed.websiteCta.status, "available");
if (allowed.websiteCta.status !== "available") throw new Error("expected website CTA");
assert.equal(allowed.websiteCta.value, `<a href="https://mens-esthe-kuchikomi.com/r/${tokenQr}/">口コミをEskomiで投稿</a>`, "the website CTA must be fixed safe markup around the canonical review URL");
assert.doesNotMatch(allowed.websiteCta.value, /<script|\son\w+\s*=|iframe/i, "the website CTA must never carry executable markup or arbitrary event attributes");
assert.deepEqual(JSON.parse(JSON.stringify(allowed.reviewMetrics)), { status: "available", submitted: 8, pending: 2, published: 5 }, "review metrics must preserve the existing Native Review counts");
assert.deepEqual(JSON.parse(JSON.stringify(allowed.campaignMetrics)), { status: "unavailable" }, "legacy WordPress campaign metrics must not be projected for a canonical workspace");
assert.equal(allowed.widgetUrl.status, "available");
assert.equal(allowed.widgetUrl.value, `https://mens-esthe-kuchikomi.com/partner/widget/${tokenWidget}/`, "the widget URL must derive from the canonical widget handle");
assert.equal(Object.keys(allowed).sort().join(","), "campaignMetrics,lineMessage,qr,reviewMetrics,reviewUrl,status,websiteCta,widgetUrl", "the dashboard projection must omit reviewer and campaign-internal fields");
assert.doesNotMatch(JSON.stringify(allowed), /email|memo|reviewBody|contact|ipAddress/i, "the dashboard projection must not expose reviewer PII, raw reviews, or moderation notes");

assert.deepEqual(
  JSON.parse(JSON.stringify(kit.resolvePartnerReviewGrowthKit(identityA, { ...metricsA, workspaceId: workspaceB }))),
  { status: "forbidden" },
  "Partner A must be denied rather than receive Partner B workspace metrics",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(kit.resolvePartnerReviewGrowthKit(identityA, { ...metricsA, appShopId: "88888888-8888-4888-8888-888888888888" }))),
  { status: "forbidden" },
  "a campaign/metric result for a different linked shop must fail closed",
);

const unavailable = kit.resolvePartnerReviewGrowthKit(identityA, null);
assert.deepEqual(JSON.parse(JSON.stringify(unavailable)), {
  status: "allowed",
  reviewUrl: { status: "unavailable" },
  qr: { status: "unavailable" },
  lineMessage: { status: "unavailable" },
  websiteCta: { status: "unavailable" },
  widgetUrl: { status: "unavailable" },
  reviewMetrics: { status: "unavailable" },
  campaignMetrics: { status: "unavailable" },
}, "unavailable Phase 2 data must never be invented as zero-valued Partner metrics");

console.log("partner review Growth Kit contract: PASS");
