import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const pathFor = (file) => join(root, file);
const read = (file) => readFileSync(pathFor(file), "utf8");

const requiredFiles = [
  "components/dashboard/DashboardShell.tsx",
  "components/dashboard/DashboardNav.tsx",
  "components/dashboard/DashboardShell.module.css",
  "lib/dashboard/navigation.ts",
  "lib/dashboard/data-result.ts",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(pathFor(file)), `${file} が必要です`);
}

const layoutSource = read("app/dashboard/layout.tsx");
const dashboardPageSource = read("app/dashboard/page.tsx");
const analyticsPageSource = read("app/dashboard/analytics/page.tsx");
const navigationSource = read("lib/dashboard/navigation.ts");
const shellSource = read("components/dashboard/DashboardShell.tsx");
const navSource = read("components/dashboard/DashboardNav.tsx");
const shellCss = read("components/dashboard/DashboardShell.module.css");
const dataResultSource = read("lib/dashboard/data-result.ts");
const gaSource = read("lib/ga.ts");
const searchConsoleSource = read("lib/searchConsole.ts");
const analyticsDashboardSource = read("components/AnalyticsDashboard.tsx");
const googleAnalyticsSource = read("components/GoogleAnalytics.tsx");
const quickLinksSource = read("components/WPQuickLinks.tsx");
const packageSource = read("package.json");

assert.match(layoutSource, /<DashboardShell>\s*\{children\}\s*<\/DashboardShell>/s);
assert.match(navigationSource, /href:\s*["']\/dashboard\/["']/);
assert.match(navigationSource, /href:\s*["']\/dashboard\/analytics\/["']/);
assert.doesNotMatch(navigationSource, /\/dashboard\/(?:shops|admin|imports|therapists)\//);
assert.doesNotMatch(dashboardPageSource, /className=["']dashboard-shell["']/);
assert.doesNotMatch(analyticsPageSource, /className=["']dashboard-shell["']/);
assert.match(dashboardPageSource, /<AnalyticsDashboard\s*\/>/);
assert.match(
  analyticsPageSource,
  /<AnalyticsDashboard\s+showWeekly\s+showQuickLinks=\{false\}\s*\/>/
);

assert.match(shellSource, /<DashboardNav\s*\/>/);
assert.match(shellSource, /href=["']#dashboard-main["']/);
assert.match(shellSource, /id=["']dashboard-main["']/);
assert.match(navSource, /aria-current=\{isCurrent\s*\?\s*["']page["']\s*:\s*undefined\}/);
assert.match(navSource, /aria-controls=/);
assert.match(navSource, /aria-expanded=/);
assert.match(navSource, /onKeyDown=/);

assert.match(
  shellCss,
  /grid-template-columns:\s*minmax\(220px,\s*260px\)\s+minmax\(0,\s*1fr\)/
);
assert.match(shellCss, /@media\s*\(max-width:\s*900px\)/);
assert.match(shellCss, /min-height:\s*44px/);
assert.match(shellCss, /min-width:\s*0/);
assert.match(shellCss, /overflow-x:\s*(?:hidden|clip)/);

assert.doesNotMatch(gaSource, /mockDaily|mockTotals|MOCK_PAGES|MOCK_CREATIVES|MOCK_CTA|_mock/);
assert.doesNotMatch(searchConsoleSource, /MOCK_SEARCH_/);
assert.doesNotMatch(gaSource, /supa\s*!==\s*fallback/);
assert.doesNotMatch(searchConsoleSource, /supa\s*!==\s*fallback/);
assert.doesNotMatch(
  gaSource,
  /\btoNumber\(/,
  "GA4の不正な値を実0件へ丸めてはいけません"
);
assert.doesNotMatch(
  searchConsoleSource,
  /\btoNumber\(/,
  "Search Consoleの不正な値を実0件へ丸めてはいけません"
);
assert.match(dataResultSource, /status:\s*["']live["']/);
assert.match(dataResultSource, /status:\s*["']unavailable["']/);
assert.match(dataResultSource, /data:\s*null/);

assert.doesNotMatch(quickLinksSource, /localhost:3333|Agent Foundation|AI記憶|進捗モニター/);
assert.match(quickLinksSource, /https:\/\/analytics\.google\.com\//);
assert.match(quickLinksSource, /https:\/\/search\.google\.com\/search-console\//);
assert.doesNotMatch(analyticsDashboardSource, /<button[^>]*>\s*\{prompt\}/s);
assert.doesNotMatch(analyticsDashboardSource, /AI Workbench|aiPromptSeeds/);

assert.match(googleAnalyticsSource, /pathname\.startsWith\(["']\/dashboard["']\)/);
assert.match(googleAnalyticsSource, /if\s*\(pathname\.startsWith\(["']\/dashboard["']\)\)\s*return\s+null/);
const dashboardGuards = googleAnalyticsSource.match(
  /if\s*\(pathname\.startsWith\(["']\/dashboard["']\)\)\s*return/g
);
assert.ok(
  (dashboardGuards?.length ?? 0) >= 4,
  "dashboardではrender、pageview、shop_view、click listenerをすべて止める必要があります"
);

assert.match(analyticsDashboardSource, /GA4/);
assert.match(analyticsDashboardSource, /Search Console/);
assert.match(analyticsDashboardSource, /分析用Supabase/);
assert.match(analyticsDashboardSource, /未取得|未連携|取得できません/);
assert.match(packageSource, /["']test:dashboard-shell["']\s*:/);
assert.match(packageSource, /npm run test:dashboard-shell/);

const dataResultCompiled = ts.transpileModule(dataResultSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const dataResultModule = { exports: {} };
vm.runInNewContext(
  dataResultCompiled,
  {
    module: dataResultModule,
    exports: dataResultModule.exports,
  },
  { filename: "dashboard-data-result.cjs" }
);

const { parseDashboardNumber, resolveDashboardData } = dataResultModule.exports;
assert.equal(typeof resolveDashboardData, "function", "production helperを公開する必要があります");
assert.equal(typeof parseDashboardNumber, "function", "数値responseの検証helperが必要です");
assert.equal(parseDashboardNumber(0), 0, "実0値を維持する必要があります");
assert.equal(parseDashboardNumber("0"), 0, "APIの文字列0を実0値として扱う必要があります");
assert.equal(parseDashboardNumber(null), null, "nullを実0値へ丸めてはいけません");
assert.equal(parseDashboardNumber("not-a-number"), null, "不正な数値を実0値へ丸めてはいけません");

const zeroResult = await resolveDashboardData({
  source: "ga4",
  configured: true,
  request: async () => [],
  validate: Array.isArray,
  now: () => "2026-07-18T00:00:00.000Z",
});
assert.equal(zeroResult.status, "live", "成功0件はliveとして扱う必要があります");
assert.deepEqual(Array.from(zeroResult.data), []);
assert.equal(zeroResult.fetchedAt, "2026-07-18T00:00:00.000Z");

let notConfiguredCalled = false;
const notConfiguredResult = await resolveDashboardData({
  source: "analytics-supabase",
  configured: false,
  request: async () => {
    notConfiguredCalled = true;
    return [];
  },
  validate: Array.isArray,
});
assert.equal(notConfiguredCalled, false, "未設定時はrequestしてはいけません");
assert.equal(notConfiguredResult.status, "unavailable");
assert.equal(notConfiguredResult.reason, "not-configured");
assert.equal(notConfiguredResult.data, null);

const failedResult = await resolveDashboardData({
  source: "search-console",
  configured: true,
  request: async () => {
    throw new Error("fixture request failure");
  },
  validate: Array.isArray,
});
assert.equal(failedResult.status, "unavailable");
assert.equal(failedResult.reason, "request-failed");
assert.equal(failedResult.data, null);

const invalidResult = await resolveDashboardData({
  source: "legacy-proxy",
  configured: true,
  request: async () => ({ rows: [] }),
  validate: Array.isArray,
});
assert.equal(invalidResult.status, "unavailable");
assert.equal(invalidResult.reason, "invalid-response");
assert.equal(invalidResult.data, null);

console.log("Dashboard shell contract checks passed");
