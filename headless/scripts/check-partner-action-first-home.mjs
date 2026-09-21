import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const authPath = join(root, "lib/partner/partner-auth.ts");
const dashboardPath = join(root, "lib/partner/partner-dashboard.ts");

function loadModule(source, filename, modules = {}) {
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
      if (specifier in modules) return modules[specifier];
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
  });
  return module.exports;
}

function loadJsxModule(source, filename) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
  });
  return module.exports;
}

const auth = loadModule(readFileSync(authPath, "utf8"), authPath);
const dashboard = loadModule(readFileSync(dashboardPath, "utf8"), dashboardPath, { "@/lib/partner/partner-auth": auth });

assert.equal(
  typeof dashboard.resolvePartnerActionFirstHome,
  "function",
  "GROWTH-01 must add a server-only Home projection instead of re-deriving Partner state in the browser",
);

const identity = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  shopId: 101,
  shopSlug: "shop-a",
  shopName: "Partner Shop A",
  canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
  state: "free_official_partner",
};

const readyGrowthKit = {
  status: "allowed",
  reviewUrl: { status: "available", value: "https://mens-esthe-kuchikomi.com/r/33333333-3333-4333-8333-333333333333/" },
  qr: { status: "available", value: "https://mens-esthe-kuchikomi.com/r/33333333-3333-4333-8333-333333333333/" },
  lineMessage: { status: "available", value: "ご来店後のご感想を、率直にお聞かせください。\nhttps://mens-esthe-kuchikomi.com/r/44444444-4444-4444-8444-444444444444/" },
  websiteCta: { status: "available", value: "<a href=\"https://mens-esthe-kuchikomi.com/r/55555555-5555-4555-8555-555555555555/\">口コミをEskomiで投稿</a>" },
  widgetUrl: { status: "available", value: "https://mens-esthe-kuchikomi.com/partner/widget/55555555-5555-4555-8555-555555555555/" },
  reviewMetrics: { status: "available", submitted: 8, pending: 2, published: 5 },
  campaignMetrics: { status: "available", value: [{ channel: "counter_qr", open: 12, conversion: 4 }] },
};

const readyHome = dashboard.resolvePartnerActionFirstHome(identity, readyGrowthKit);
assert.deepEqual(JSON.parse(JSON.stringify(readyHome.context)), {
  shopName: "Partner Shop A",
  partnerStatus: "Free Official Partner",
  canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
}, "the Home context must contain only the safe canonical identity fields needed by the Partner");
assert.deepEqual(JSON.parse(JSON.stringify(readyHome.action)), {
  kind: "review_growth_ready",
  title: "口コミを集められます",
  description: "まず口コミURLを確認し、QRやLINEで率直な口コミをご案内してください。",
  primaryAction: { label: "口コミURLを確認する", href: "#partner-collect-reviews" },
}, "an active Growth Kit must give exactly one primary next action");
assert.equal(readyHome.performance.status, "available");
assert.deepEqual(JSON.parse(JSON.stringify(readyHome.performance.metrics)), [
  { key: "submitted", label: "投稿済み", value: 8, source: "native_review", period: "all_time", grain: "workspace_shop" },
  { key: "pending", label: "審査中", value: 2, source: "native_review", period: "all_time", grain: "workspace_shop" },
  { key: "published", label: "公開済み", value: 5, source: "native_review", period: "all_time", grain: "workspace_shop" },
], "displayed Home KPIs must retain their source, period, grain, and real values without inventing a rate");
assert.equal(readyHome.collection.filter((asset) => asset.status === "available").length, 5, "a ready Growth Kit must expose only existing quick-access assets");
assert.equal(readyHome.recentActivity.status, "unavailable", "GROWTH-01 must not invent an activity feed without a reliable event source");
assert.doesNotMatch(JSON.stringify(readyHome), /workspaceId|shopId|shopSlug|token|email|service.?role|private/i, "the rendered Home projection must omit internal IDs, tokens, PII, and service authority");

const noCampaignHome = dashboard.resolvePartnerActionFirstHome(identity, {
  ...readyGrowthKit,
  reviewUrl: { status: "unavailable" }, qr: { status: "unavailable" }, lineMessage: { status: "unavailable" },
  websiteCta: { status: "unavailable" }, widgetUrl: { status: "unavailable" },
  reviewMetrics: { status: "unavailable" }, campaignMetrics: { status: "unavailable" },
});
assert.deepEqual(JSON.parse(JSON.stringify(noCampaignHome.action)), {
  kind: "growth_kit_unavailable",
  title: "口コミ導線は準備中です",
  description: "有効な口コミCampaignを確認できないため、口コミURLはまだ利用できません。",
  primaryAction: { label: "公開店舗ページを確認する", href: "https://mens-esthe-kuchikomi.com/shops/shop-a/" },
}, "no-campaign state must name its prerequisite and retain one safe primary action without fabricating a URL");
assert.deepEqual(JSON.parse(JSON.stringify(noCampaignHome.performance)), {
  status: "unavailable",
  message: "口コミ件数を現在確認できません。",
}, "unavailable metrics must not be rendered as zero");
assert.equal(noCampaignHome.collection.every((asset) => asset.status === "unavailable"), true, "an unavailable Growth Kit must not expose a working asset");

const zeroReviewHome = dashboard.resolvePartnerActionFirstHome(identity, {
  ...readyGrowthKit,
  reviewMetrics: { status: "available", submitted: 0, pending: 0, published: 0 },
});
assert.equal(zeroReviewHome.action.kind, "first_review", "a real zero review count must be distinguishable from unavailable metrics");
assert.equal(zeroReviewHome.performance.status, "available");
if (zeroReviewHome.performance.status !== "available") throw new Error("expected zero-review metrics to remain available");
assert.deepEqual(JSON.parse(JSON.stringify(zeroReviewHome.performance.metrics.map((metric) => metric.value))), [0, 0, 0], "real zero counts must be retained only when Native Review metrics are available");

const loadingPath = join(root, "app/partner/loading.tsx");
const loading = loadJsxModule(readFileSync(loadingPath, "utf8"), loadingPath).default;
const loadingHtml = renderToStaticMarkup(createElement(loading));
assert.match(loadingHtml, /aria-busy="true"/, "the protected Partner Home must render an explicit loading state while its server projection is resolving");
assert.match(loadingHtml, /パートナーダッシュボードを読み込んでいます/, "the loading state must name the screen rather than imply an unavailable or zero metric state");

console.log("partner action-first Home contract: PASS");
