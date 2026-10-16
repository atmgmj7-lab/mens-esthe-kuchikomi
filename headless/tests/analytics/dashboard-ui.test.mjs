import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { parseAnalyticsDashboardParams, formatMetric, formatDelta, sourceStateLabel } = await import("../../app/dashboard/analytics/dashboard-ui.ts");

test("dashboard parsing defaults only absent filters and rejects unknown, duplicate, and invalid values", () => {
  assert.deepEqual(parseAnalyticsDashboardParams({}), { ok: true, days: 7, view: "overview" });
  assert.deepEqual(parseAnalyticsDashboardParams({ period: "28", view: "pages" }), { ok: true, days: 28, view: "pages" });
  assert.equal(parseAnalyticsDashboardParams({ period: ["7", "28"] }).ok, false);
  assert.equal(parseAnalyticsDashboardParams({ period: "14" }).ok, false);
  assert.equal(parseAnalyticsDashboardParams({ view: "unknown" }).ok, false);
  assert.equal(parseAnalyticsDashboardParams({ period: "7", extra: "x" }).ok, false);
});

test("dashboard formatting preserves actual zero and distinguishes unavailable values and position semantics", () => {
  assert.equal(formatMetric(0, "count"), "0");
  assert.equal(formatMetric(0, "percent"), "0.0%");
  assert.equal(formatMetric(null, "count"), "—");
  assert.equal(formatDelta(0, "count"), "+0");
  assert.equal(formatDelta(-2, "position"), "2.0 改善");
  assert.equal(formatDelta(2, "position"), "2.0 悪化");
  assert.equal(sourceStateLabel("not_configured"), "未設定");
  assert.equal(sourceStateLabel("no_data"), "対象期間にデータなし");
});

test("production page and API share the cached server boundary while presentation has no direct source fetch", async () => {
  const page = await readFile(new URL("../../app/dashboard/analytics/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/dashboard/analytics/current/route.ts", import.meta.url), "utf8");
  const snapshotModule = await readFile(new URL("../../lib/analytics/snapshot.ts", import.meta.url), "utf8");
  const presentation = await readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.ts", import.meta.url), "utf8");
  assert.match(page, /import \{ collectAnalyticsSnapshot \} from "@\/lib\/analytics\/snapshot"/);
  assert.match(page, /await collectAnalyticsSnapshot\(\{ days: parsed\.days \}\)/);
  assert.match(snapshotModule, /const \{ getAnalyticsSnapshot \} = await import\("\.\/snapshot-cache"\)/);
  assert.match(snapshotModule, /return getAnalyticsSnapshot\(\{ days: options\.days \}\)/);
  assert.match(route, /collect: \(\{ days \}\) => getAnalyticsSnapshot\(\{ days \}\)/);
  assert.doesNotMatch(route, /collectAnalyticsSnapshot/);
  assert.doesNotMatch(page, /fetch\(|\/api\/dashboard\/analytics/);
  assert.doesNotMatch(presentation, /fetch\(|collectAnalyticsSnapshot|collectGa4|collectGsc|WordPress/);
});

test("route-local loading, error, noindex metadata, five view navigation, and accessible scroll regions are present", async () => {
  const [layout, loading, error, presentation, ui] = await Promise.all([
    readFile(new URL("../../app/dashboard/analytics/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/dashboard/analytics/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/dashboard/analytics/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/dashboard/analytics/dashboard-ui.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /index: false/);
  assert.match(error, /"use client"/);
  assert.match(loading, /aria-busy/);
  for (const name of ["overview", "seo", "pages", "site-health", "content-health"]) assert.match(ui, new RegExp(`"${name}"`));
  assert.match(presentation, /tabIndex: 0/);
  assert.match(presentation, /h\("caption"/);
});

test("SEO and Pages retain every current/previous metric, visibly mark actual zero, and expose an empty page state", async () => {
  const presentation = await readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.ts", import.meta.url), "utf8");
  for (const label of ["前表示回数", "前CTR", "前順位", "前Organic", "Organic差分", "前Engaged", "前Engagement rate", "前GSC clicks", "前GSC impressions", "前GSC CTR", "前GSC position"]) assert.match(presentation, new RegExp(label));
  assert.match(presentation, /current === 0 \? styles\.zero/);
  assert.match(presentation, /value === 0 \? styles\.zero/);
  assert.match(presentation, /ページ別のデータはありません/);
});

test("dashboard text tokens keep AA contrast on the ivory shell, cards, and navigation states", async () => {
  const css = await readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.module.css", import.meta.url), "utf8");
  const view = await readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.ts", import.meta.url), "utf8");
  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  };
  const property = (selector, name) => {
    const value = rule(selector).match(new RegExp(`(?:^|;)\\s*${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    assert.ok(value, `${selector} に ${name} の明示色が必要です`);
    return value;
  };
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (foreground, background) => {
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  for (const selector of [".page", ".eyebrow", ".hero .muted", ".filterLink", ".filterLink:hover", ".section h3", ".sectionLead", ".details"]) {
    const color = property(selector, "color");
    assert.ok(contrast(color, "#f7f4ee") >= 4.5, `${color} はアイボリー背景上で4.5:1以上が必要です`);
  }
  for (const selector of [".card", ".scrollRegion"]) {
    const color = property(selector, "color");
    assert.ok(contrast(color, "#ffffff") >= 4.5, `${color} は白背景上で4.5:1以上が必要です`);
  }
  for (const [selector, foreground, background] of [[".filterLink:hover", property(".filterLink:hover", "color"), "#edf3f2"], [".filterLink[aria-current=\"page\"]", property(".filterLink[aria-current=\"page\"]", "color"), "#143d4d"], [".filterLink[aria-disabled=\"true\"]", property(".filterLink[aria-disabled=\"true\"]", "color"), "#efede7"], [".filterLink[aria-current=\"page\"][aria-disabled=\"true\"]", property(".filterLink[aria-current=\"page\"][aria-disabled=\"true\"]", "color"), "#143d4d"], [".stateOk", property(".stateOk", "color"), "#dff4e8"], [".statePartial", property(".statePartial", "color"), "#fff0c6"], [".stateError", property(".stateError", "color"), "#ffe1e1"], [".unavailable", property(".unavailable", "color"), "#fff8e6"]]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${selector}: ${foreground} は ${background} 上で4.5:1以上が必要です`);
  }
  const focusColor = rule(".filterLink:focus-visible, .scrollRegion:focus-visible, .details summary:focus-visible").match(/outline:\s*3px solid\s*(#[0-9a-f]{6})/i)?.[1];
  assert.ok(focusColor, "キーボードフォーカスの輪郭色を明示する必要があります");
  assert.ok(contrast(focusColor, "#f7f4ee") >= 3, "フォーカス輪郭はアイボリー背景上で3:1以上が必要です");
  assert.match(view, /selected\s*\?\s*h\("span",\s*\{[^}]*"aria-disabled":\s*true/, "現在の表示条件は操作不能な現在地として出力する必要があります");
});
