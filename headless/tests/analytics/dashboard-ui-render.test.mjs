import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes("/app/dashboard/analytics/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { default: AnalyticsDashboardView } = await import("../../app/dashboard/analytics/AnalyticsDashboardView.ts");
const styles = Object.fromEntries(["page", "hero", "eyebrow", "muted", "filters", "filterGroup", "filterLink", "statusGrid", "kpiGrid", "card", "cardTitle", "value", "zero", "comparison", "badge", "stateOk", "statePartial", "stateError", "section", "sectionLead", "scrollRegion", "table", "numeric", "path", "details", "warningList", "unavailable", "bar"].map((key) => [key, key]));
const at = "2026-08-23T00:00:00.000Z";
const origin = "https://mens-esthe-kuchikomi.com";
const metric = (number) => ({ clicks: number, impressions: number * 10, ctr: number / 100, position: number + 1 });
const paths = [["堺東", "/area/sakai/"], ["新大阪", "/area/shinosaka/"], ["大阪日本橋", "/area/nihonbashi/"], ["堺筋本町", "/area/sakaisujihonmachi/"], ["梅田", "/area/umeda/"]];
const health = ["/", ...paths.map(([, pathname]) => pathname)].map((pathname) => ({ path: pathname, url: `${origin}${pathname}`, httpStatus: 200, checkedAt: at, state: "ok", data: { title: `title ${pathname}`, h1: `h1 ${pathname}`, canonical: `${origin}${pathname}`, robots: "index,follow", indexable: true, indexabilityReason: "indexable" }, warnings: [] }));

function snapshot() {
  const period = { days: 7, timezone: "Asia/Tokyo", requested: { current: { startDate: "2026-08-16", endDate: "2026-08-22" }, previous: { startDate: "2026-08-09", endDate: "2026-08-15" } }, effective: { current: { startDate: "2026-08-16", endDate: "2026-08-22" }, previous: { startDate: "2026-08-09", endDate: "2026-08-15" } } };
  const source = (state = "ok") => ({ state, collectedAt: at, warnings: [] });
  return {
    schemaVersion: "1.0.0", timezone: "Asia/Tokyo", generatedAt: at, collectedAt: at, period,
    sources: { ga4: { ...source(), period }, gsc: { ...source("partial"), period }, web: source(), content: source() },
    overview: { current: { sessions: 0, activeUsers: 2, engagedSessions: 1, engagementRate: 0.5, keyEvents: 0, organicSessions: 1, gsc: metric(0) }, previous: { sessions: 1, activeUsers: 1, engagedSessions: 0, engagementRate: 0, keyEvents: 1, organicSessions: 0, gsc: metric(1) }, deltas: { sessions: -1, activeUsers: 1, engagedSessions: 1, engagementRate: 0.5, keyEvents: -1, organicSessions: 1, clicks: -1, impressions: -10, ctr: -0.01, position: -1 } },
    seo: { focusAreas: paths.map(([name, path], index) => ({ name, path, mainQuery: index ? `${name} メンズエステ` : null, current: { ...metric(index), organicSessions: index }, previous: { ...metric(index + 1), organicSessions: index + 1 }, deltas: { clicks: -1, impressions: -10, ctr: -0.01, position: -1, organicSessions: -1 }, siteHealth: health[index + 1], checkedAt: at, collectedAt: at })), topCounts: { top10: null, top20: 4, top30: 5 } },
    pages: [{ path: "/area/sakai/", current: { sessions: 0, engagedSessions: 0, engagementRate: 0, keyEvents: 0, organicSessions: 0, gsc: metric(0) }, previous: { sessions: 2, engagedSessions: 1, engagementRate: 0.5, keyEvents: 1, organicSessions: 1, gsc: metric(1) } }],
    siteHealth: health,
    contentHealth: { staleAfterDays: 180, areas: [{ area: { id: 1, slug: "umeda", name: "梅田", parentId: 0, publishedShopCount: 0 }, publishedShops: 0, verifiedPriceCount: 0, verifiedHoursCount: 0, verifiedOfficialUrlCount: 0, verifiedAccessCount: 0, approvedReviewCount: 0, staleConfirmedDateShopCount: 0, missingRate: null }] },
    warnings: [{ code: "synthetic_warning", message: "not rendered" }],
  };
}

function render(view, data = snapshot()) { return renderToStaticMarkup(createElement(AnalyticsDashboardView, { snapshot: data, view, styles })); }

test("production presentation renders all five source-backed views with zero, null, and structured evidence intact", () => {
  const overview = render("overview");
  for (const label of ["GA4 集計", "セッション", "Organic Search セッション", "キーイベント", "Google Search Console 集計", "取得済み", "一部取得"]) assert.match(overview, new RegExp(label));
  assert.match(overview, /class="value zero">0/);
  const seo = render("seo");
  assert.equal((seo.match(/<strong>堺東<\/strong>/g) ?? []).length, 1);
  assert.equal((seo.match(/<strong>/g) ?? []).length >= 5, true);
  assert.match(seo, /GSC行が完全ではないため算出不可/);
  for (const label of ["前表示回数", "前CTR", "前順位", "前Organic", "Organic差分", "title", "canonical", "indexability"]) assert.match(seo, new RegExp(label));
  const pages = render("pages");
  for (const label of ["前Engaged", "前Engagement rate", "前GSC clicks", "前GSC impressions", "前GSC CTR", "前GSC position"]) assert.match(pages, new RegExp(label));
  assert.match(render("site-health"), /固定6 URL の検査結果/);
  assert.equal((render("site-health").match(/indexable/g) ?? []).length >= 6, true);
  const content = render("content-health");
  assert.match(content, /確認日の古さの閾値: 180日/);
  assert.match(content, /算出不可/);
});

test("production presentation gives source-state and no-row states an explicit non-zero label", () => {
  const emptyPages = { ...snapshot(), pages: [] };
  assert.match(render("pages", emptyPages), /ページ別のデータはありません/);
  const unavailableContent = { ...snapshot(), sources: { ...snapshot().sources, content: { state: "not_configured", collectedAt: at, warnings: [] } }, contentHealth: null };
  assert.match(render("content-health", unavailableContent), /未設定/);
});

test("every production view shows all source states with real freshness and effective periods", () => {
  const base = snapshot();
  const unavailableGscMetric = { clicks: null, impressions: null, ctr: null, position: null };
  const mixedStates = {
    ...base,
    sources: {
      ga4: { ...base.sources.ga4, state: "not_configured" },
      gsc: { ...base.sources.gsc, state: "no_data" },
      web: { ...base.sources.web, state: "timeout" },
      content: { ...base.sources.content, state: "partial" },
    },
    overview: {
      current: { sessions: null, activeUsers: null, engagedSessions: null, engagementRate: null, keyEvents: null, organicSessions: null, gsc: unavailableGscMetric },
      previous: { sessions: null, activeUsers: null, engagedSessions: null, engagementRate: null, keyEvents: null, organicSessions: null, gsc: unavailableGscMetric },
      deltas: { sessions: null, activeUsers: null, engagedSessions: null, engagementRate: null, keyEvents: null, organicSessions: null, clicks: null, impressions: null, ctr: null, position: null },
    },
    seo: { focusAreas: [], topCounts: { top10: null, top20: null, top30: null } },
    pages: [],
    siteHealth: null,
    contentHealth: {
      ...base.contentHealth,
      areas: base.contentHealth.areas.map((area) => ({
        ...area,
        publishedShops: 1,
        verifiedPriceCount: 1,
        verifiedHoursCount: 1,
        verifiedOfficialUrlCount: 1,
        verifiedAccessCount: 1,
        approvedReviewCount: 1,
        staleConfirmedDateShopCount: 1,
      })),
    },
  };

  for (const view of ["overview", "seo", "pages", "site-health", "content-health"]) {
    const html = render(view, mixedStates);
    for (const label of [
      "GA4",
      "Search Console",
      "Site Health",
      "Content Health",
      "未設定",
      "対象期間にデータなし",
      "取得エラー（タイムアウト）",
      "一部取得",
    ]) {
      assert.match(html, new RegExp(label), `${view} に ${label} が必要です`);
    }
    assert.equal((html.match(/収集: 2026/g) ?? []).length, 4, `${view} に実収集時刻が必要です`);
    const statusSection = html.match(/<section class="statusGrid"[\s\S]*?<\/section>/)?.[0] ?? "";
    assert.equal(
      (statusSection.match(/有効期間: 2026-08-16 〜 2026-08-22/g) ?? []).length,
      2,
      `${view} にGA4/GSCの実効期間が必要です`,
    );
    assert.doesNotMatch(statusSection, />0</, `${view} でno_dataを0に変換してはいけません`);
    assert.doesNotMatch(html, /class="value zero">0/, `${view} で取得不能値を実0へ変換してはいけません`);
  }

  assert.match(render("overview", mixedStates), /class="value">—/);
  assert.match(render("overview", base), /class="value zero">0/);
});
