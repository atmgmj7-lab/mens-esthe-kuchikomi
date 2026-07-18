import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(root, "..");
const pathFor = (file) => join(root, file);
const read = (file) => readFileSync(pathFor(file), "utf8");

const requiredFiles = [
  "components/dashboard/DashboardShell.tsx",
  "components/dashboard/DashboardNav.tsx",
  "components/dashboard/DashboardShell.module.css",
  "lib/dashboard/navigation.ts",
  "lib/dashboard/data-result.ts",
  "lib/dashboard/ga-contract.ts",
  "lib/dashboard/line-chart.ts",
  "lib/dashboard/source-status.ts",
  "scripts/check-dashboard-shell-browser.mjs",
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
const globalCss = read("app/globals.css");
const dataResultSource = read("lib/dashboard/data-result.ts");
const gaSource = read("lib/ga.ts");
const searchConsoleSource = read("lib/searchConsole.ts");
const analyticsDashboardSource = read("components/AnalyticsDashboard.tsx");
const googleAnalyticsSource = read("components/GoogleAnalytics.tsx");
const quickLinksSource = read("components/WPQuickLinks.tsx");
const packageSource = read("package.json");
const gaProxySource = readFileSync(
  join(repositoryRoot, "dashboard/public/api/ga-proxy.php"),
  "utf8"
);
const legacyGaSource = readFileSync(
  join(repositoryRoot, "dashboard/lib/ga.ts"),
  "utf8"
);
const legacyAnalyticsDashboardSource = readFileSync(
  join(repositoryRoot, "dashboard/components/AnalyticsDashboard.tsx"),
  "utf8"
);
const legacyLineChartPath = join(repositoryRoot, "dashboard/components/LineChart.tsx");
const legacyLineChartContractPath = join(repositoryRoot, "dashboard/lib/line-chart.ts");
assert.ok(existsSync(legacyLineChartContractPath), "dashboard/lib/line-chart.ts が必要です");
const legacyLineChartSource = readFileSync(legacyLineChartPath, "utf8");
const legacyLineChartContractSource = readFileSync(legacyLineChartContractPath, "utf8");
const gaContractSource = read("lib/dashboard/ga-contract.ts");
const lineChartContractSource = read("lib/dashboard/line-chart.ts");
const sourceStatusSource = read("lib/dashboard/source-status.ts");
const lineChartSource = read("components/LineChart.tsx");

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
assert.match(navSource, /document\.addEventListener\(["']keydown["']/);
assert.match(navSource, /requestAnimationFrame/);
assert.match(navSource, /getElementById\(["']dashboard-main["']\)/);
assert.match(navSource, /hasMountedRef/);

assert.match(
  shellCss,
  /grid-template-columns:\s*minmax\(220px,\s*260px\)\s+minmax\(0,\s*1fr\)/
);
assert.match(shellCss, /@media\s*\(max-width:\s*900px\)/);
assert.match(shellCss, /min-height:\s*44px/);
assert.match(shellCss, /min-width:\s*0/);
assert.match(shellCss, /overflow-x:\s*(?:hidden|clip)/);
assert.doesNotMatch(
  shellCss,
  /transition\s*:[^;]*visibility/,
  "drawerのvisibilityをtransition対象にするとopen直後のfocusが失敗します"
);

assert.doesNotMatch(gaSource, /mockDaily|mockTotals|MOCK_PAGES|MOCK_CREATIVES|MOCK_CTA|_mock/);
assert.doesNotMatch(
  legacyGaSource,
  /mockDaily|mockTotals|MOCK_PAGES|MOCK_CREATIVES|_mock|\bfallback\b/,
  "Xserver配信対象の旧dashboardにもmock/fallbackを残してはいけません"
);
assert.match(legacyGaSource, /parseGa4LiveEnvelope/);
assert.doesNotMatch(legacyAnalyticsDashboardSource, /_mock|モックデータ/);
assert.match(legacyAnalyticsDashboardSource, /error=/);
assert.match(legacyLineChartSource, /buildLineChartModel/);
assert.match(legacyLineChartSource, /serializeLineChartPoints/);
assert.match(legacyLineChartSource, /key=\{`\$\{idx\}-\$\{data\[idx\]\.date\}`\}/);
assert.doesNotMatch(searchConsoleSource, /MOCK_SEARCH_/);
assert.doesNotMatch(gaSource, /supa\s*!==\s*fallback/);
assert.doesNotMatch(searchConsoleSource, /supa\s*!==\s*fallback/);
assert.doesNotMatch(
  gaProxySource,
  /get_mock_data|mock_day_count|_mock|rand\s*\(/,
  "旧GA proxyからmock生成を完全に削除する必要があります"
);
assert.match(gaProxySource, /http_response_code\(503\)/);
assert.match(gaProxySource, /["']status["']\s*=>\s*["']live["']/);
assert.match(gaProxySource, /["']source["']\s*=>\s*["']ga4["']/);
assert.match(gaProxySource, /["']data["']\s*=>\s*\$data/);
assert.match(gaSource, /parseGa4LiveEnvelope/);
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
assert.doesNotMatch(
  analyticsDashboardSource,
  /data-status=\{isSupabaseConfigured\s*\?\s*["']live["']/,
  "Supabaseは設定だけでliveにしてはいけません"
);
assert.match(analyticsDashboardSource, /data-status=\{supabaseStatus\.status\}/);
assert.match(globalCss, /article\[data-status=["']neutral["']\]/);
assert.match(lineChartSource, /buildLineChartModel/);
assert.match(packageSource, /["']test:dashboard-shell["']\s*:/);
assert.match(packageSource, /npm run test:dashboard-shell/);
assert.match(packageSource, /["']test:dashboard-shell-browser["']\s*:/);

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

function loadTsModule(source, filename) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(
    compiled,
    { module: loaded, exports: loaded.exports },
    { filename }
  );
  return loaded.exports;
}

const {
  isGa4DailyMetricList,
  normalizeGa4Date,
  parseGa4LiveEnvelope,
} = loadTsModule(gaContractSource, "ga-contract.cjs");

assert.equal(normalizeGa4Date("20260718"), "20260718");
assert.equal(normalizeGa4Date("2026-07-18"), "20260718");
assert.equal(normalizeGa4Date("20260229"), null, "存在しない日付を拒否する必要があります");
assert.equal(normalizeGa4Date("2026-13-01"), null);
assert.equal(
  isGa4DailyMetricList([{ date: "2026-02-29", pageviews: 0, sessions: 0 }]),
  false,
  "daily production validatorは存在しないISO日付を拒否する必要があります"
);
assert.equal(
  isGa4DailyMetricList([{ date: "20260228", pageviews: 0, sessions: 0 }]),
  true
);

const liveEnvelope = parseGa4LiveEnvelope({
  status: "live",
  source: "ga4",
  data: [],
});
assert.deepEqual(Array.from(liveEnvelope.data), []);
assert.equal(parseGa4LiveEnvelope([]), null, "bareの旧responseを拒否する必要があります");
assert.equal(
  parseGa4LiveEnvelope({ status: "live", source: "mock", data: [] }),
  null,
  "旧mock sourceを拒否する必要があります"
);

const { parseGa4LiveEnvelope: parseLegacyGa4LiveEnvelope } = loadTsModule(
  legacyGaSource,
  "legacy-ga-contract.cjs"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(parseLegacyGa4LiveEnvelope({
    status: "live",
    source: "ga4",
    data: [],
  }))),
  { status: "live", source: "ga4", data: [] }
);
assert.equal(parseLegacyGa4LiveEnvelope([]), null);
assert.equal(
  parseLegacyGa4LiveEnvelope({ status: "unavailable", source: "ga4", data: [] }),
  null
);
assert.equal(
  parseLegacyGa4LiveEnvelope({ status: "live", source: "mock", data: [] }),
  null
);

const { buildLineChartModel } = loadTsModule(
  lineChartContractSource,
  "line-chart-contract.cjs"
);
const oneZero = buildLineChartModel([{ date: "20260718", pageviews: 0, sessions: 0 }]);
assert.equal(oneZero.maxValue, 1);
assert.equal(oneZero.pageviewPoints.length, 1);
assert.equal(oneZero.pageviewPoints[0].x, 416, "1点はplot中央へ置く必要があります");
assert.ok(Number.isFinite(oneZero.pageviewPoints[0].y));

const multipleZero = buildLineChartModel([
  { date: "20260717", pageviews: 0, sessions: 0 },
  { date: "20260718", pageviews: 0, sessions: 0 },
]);
assert.equal(multipleZero.maxValue, 1);
assert.ok(
  multipleZero.pageviewPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
);

for (let length = 2; length <= 5; length += 1) {
  const model = buildLineChartModel(
    Array.from({ length }, (_, index) => ({
      date: `202607${String(index + 10).padStart(2, "0")}`,
      pageviews: index,
      sessions: index,
    }))
  );
  assert.equal(model.labelIndices.length, length);
  assert.equal(new Set(model.labelIndices).size, length, `${length}日fixtureのlabel keyを重複させてはいけません`);
}

const { buildLineChartModel: buildLegacyLineChartModel } = loadTsModule(
  legacyLineChartContractSource,
  "legacy-line-chart-contract.cjs"
);
const legacyOneZero = buildLegacyLineChartModel([
  { date: "20260718", pageviews: 0, sessions: 0 },
]);
assert.equal(legacyOneZero.maxValue, 1);
assert.equal(legacyOneZero.pageviewPoints[0].x, 416);
assert.ok(Number.isFinite(legacyOneZero.pageviewPoints[0].y));

const legacyMultipleZero = buildLegacyLineChartModel([
  { date: "20260717", pageviews: 0, sessions: 0 },
  { date: "20260718", pageviews: 0, sessions: 0 },
]);
assert.equal(legacyMultipleZero.maxValue, 1);
assert.ok(
  legacyMultipleZero.pageviewPoints.every(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
  )
);

for (let length = 2; length <= 5; length += 1) {
  const model = buildLegacyLineChartModel(
    Array.from({ length }, (_, index) => ({
      date: `202607${String(index + 10).padStart(2, "0")}`,
      pageviews: index,
      sessions: index,
    }))
  );
  assert.equal(model.labelIndices.length, length);
  assert.equal(new Set(model.labelIndices).size, length);
}

const { resolveSupabaseStatus } = loadTsModule(
  sourceStatusSource,
  "source-status.cjs"
);
const unavailableResults = Array.from({ length: 8 }, () => ({
  status: "unavailable",
  source: "analytics-supabase",
  data: null,
  reason: "request-failed",
}));
assert.equal(
  resolveSupabaseStatus("supabase", true, unavailableResults).status,
  "unavailable",
  "Supabase設定済みでも全取得失敗はunavailableです"
);
assert.equal(
  resolveSupabaseStatus("legacy-proxy", true, unavailableResults).status,
  "neutral"
);
assert.equal(
  resolveSupabaseStatus("legacy-proxy", true, unavailableResults).label,
  "未使用"
);

const phpOutput = execFileSync(
  "php",
  [join(repositoryRoot, "tests/php/check-ga-proxy-contract.php")],
  { encoding: "utf8" }
);
assert.match(phpOutput, /GA proxy contract: PASS/);

console.log("Dashboard shell contract checks passed");
