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

test("production page keeps collection at the server boundary and presentation has no direct source fetch", async () => {
  const page = await readFile(new URL("../../app/dashboard/analytics/page.tsx", import.meta.url), "utf8");
  const presentation = await readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.ts", import.meta.url), "utf8");
  assert.match(page, /await collectAnalyticsSnapshot\(\{ days: parsed\.days \}\)/);
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

test("dashboard text tokens keep readable contrast on the dark shell and white data surfaces", async () => {
  const css = await readFile(new URL("../../app/dashboard/analytics/AnalyticsDashboardView.module.css", import.meta.url), "utf8");
  const ruleColor = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const body = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    const color = body.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{6})/i)?.[1];
    assert.ok(color, `${selector} に明示色が必要です`);
    return color;
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

  for (const selector of [".page", ".eyebrow", ".hero .muted", ".filterLink", ".section h3", ".sectionLead", ".details"]) {
    assert.ok(contrast(ruleColor(selector), "#080d11") >= 4.5, `${selector} は暗背景上で4.5:1以上が必要です`);
  }
  for (const selector of [".card", ".scrollRegion"]) {
    assert.ok(contrast(ruleColor(selector), "#ffffff") >= 4.5, `${selector} は白背景上で4.5:1以上が必要です`);
  }
});
