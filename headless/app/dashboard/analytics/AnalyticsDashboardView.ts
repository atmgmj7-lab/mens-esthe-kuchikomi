import { createElement as h, Fragment, type ReactNode } from "react";
import type { AnalyticsSnapshot, FocusArea, SnapshotPage } from "../../../lib/analytics/snapshot";
import type { AnalyticsSourceState } from "../../../lib/analytics/result";
import { analyticsDashboardHref, dashboardViews, formatDelta, formatMetric, formatRange, formatTimestamp, sourceStateLabel, type DashboardView, type MetricKind } from "./dashboard-ui";

export type AnalyticsDashboardStyles = Record<string, string>;
type Props = Readonly<{ snapshot: AnalyticsSnapshot; view: DashboardView; styles: AnalyticsDashboardStyles }>;
type MetricCardProps = Readonly<{ label: string; current: number | null; previous: number | null; delta: number | null; kind: MetricKind; styles: AnalyticsDashboardStyles }>;
const labels = { overview: "概要", seo: "SEO", pages: "ページ", "site-health": "サイト健全性", "content-health": "コンテンツ健全性" } as const;
const cx = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

function stateClass(state: AnalyticsSourceState, styles: AnalyticsDashboardStyles): string { return state === "ok" ? styles.stateOk : state === "partial" ? styles.statePartial : styles.stateError; }
function badge(state: AnalyticsSourceState, styles: AnalyticsDashboardStyles): ReactNode { return h("span", { className: cx(styles.badge, stateClass(state, styles)), "aria-label": `状態: ${sourceStateLabel(state)}` }, "● ", sourceStateLabel(state)); }
function metricCard({ label, current, previous, delta, kind, styles }: MetricCardProps): ReactNode { return h("article", { className: styles.card, key: label }, h("p", { className: styles.cardTitle }, label), h("strong", { className: cx(styles.value, current === 0 ? styles.zero : undefined) }, formatMetric(current, kind)), h("div", { className: styles.comparison }, h("span", null, `前期間 ${formatMetric(previous, kind)}`), h("span", null, `差分 ${formatDelta(delta, kind)}`))); }
function tableCell(value: number | null, kind: MetricKind, styles: AnalyticsDashboardStyles): ReactNode { return h("td", { className: cx(styles.numeric, value === 0 ? styles.zero : undefined) }, formatMetric(value, kind)); }
function deltaCell(value: number | null, kind: MetricKind, styles: AnalyticsDashboardStyles): ReactNode { return h("td", { className: cx(styles.numeric, value === 0 ? styles.zero : undefined) }, formatDelta(value, kind)); }

function filterNav(days: 7 | 28, view: DashboardView, styles: AnalyticsDashboardStyles): ReactNode {
  return h("nav", { className: styles.filters, "aria-label": "Analytics表示条件" },
    h("div", { className: styles.filterGroup, "aria-label": "期間" }, ...([7, 28] as const).map((period) => h("a", { key: period, className: styles.filterLink, "aria-current": period === days ? "page" : undefined, href: analyticsDashboardHref(period, view) }, `${period}日`))),
    h("div", { className: styles.filterGroup, "aria-label": "ビュー" }, ...dashboardViews.map((item) => h("a", { key: item, className: styles.filterLink, "aria-current": item === view ? "page" : undefined, href: analyticsDashboardHref(days, item) }, labels[item]))),
  );
}

function sourceStatus(snapshot: AnalyticsSnapshot, styles: AnalyticsDashboardStyles): ReactNode {
  const sources = { ga4: "GA4", gsc: "Search Console", web: "Site Health", content: "Content Health" } as const;
  return h("section", { className: styles.statusGrid, "aria-label": "データソースの状態" }, ...(Object.keys(sources) as Array<keyof typeof sources>).map((key) => {
    const source = snapshot.sources[key];
    return h("article", { className: styles.card, key }, h("p", { className: styles.cardTitle }, sources[key]), badge(source.state, styles), h("p", { className: styles.muted }, `収集: ${formatTimestamp(source.collectedAt)}`), source.period ? h("p", { className: styles.muted }, `有効期間: ${formatRange(source.period.effective.current)}`) : null);
  }));
}

function overview(snapshot: AnalyticsSnapshot, styles: AnalyticsDashboardStyles): ReactNode {
  const c = snapshot.overview.current; const p = snapshot.overview.previous; const d = snapshot.overview.deltas;
  const ga4 = [["セッション", c.sessions, p.sessions, d.sessions, "count"], ["アクティブユーザー", c.activeUsers, p.activeUsers, d.activeUsers, "count"], ["エンゲージドセッション", c.engagedSessions, p.engagedSessions, d.engagedSessions, "count"], ["エンゲージメント率", c.engagementRate, p.engagementRate, d.engagementRate, "percent"], ["Organic Search セッション", c.organicSessions, p.organicSessions, d.organicSessions, "count"], ["キーイベント", c.keyEvents, p.keyEvents, d.keyEvents, "count"]] as const;
  const gsc = [["クリック", c.gsc.clicks, p.gsc.clicks, d.clicks, "count"], ["表示回数", c.gsc.impressions, p.gsc.impressions, d.impressions, "count"], ["CTR", c.gsc.ctr, p.gsc.ctr, d.ctr, "percent"], ["平均掲載順位", c.gsc.position, p.gsc.position, d.position, "position"]] as const;
  const section = (id: string, title: string, values: readonly (readonly [string, number | null, number | null, number | null, MetricKind])[]) => h("section", { className: styles.section, "aria-labelledby": id }, h("h3", { id }, title), h("div", { className: styles.kpiGrid }, ...values.map(([label, current, previous, delta, kind]) => metricCard({ label, current, previous, delta, kind, styles }))));
  return h(Fragment, null, section("ga4-heading", "GA4 集計", ga4), section("gsc-heading", "Google Search Console 集計", gsc));
}

function seoRow(row: FocusArea, styles: AnalyticsDashboardStyles): ReactNode {
  const health = row.siteHealth;
  const indexability = !health || health.data === null || health.data.indexable === null ? "算出不可" : health.data.indexable ? "indexable" : health.data.indexabilityReason;
  return h("tr", { key: row.path }, h("th", { scope: "row" }, h("strong", null, row.name), h("br"), h("span", { className: styles.path }, row.path)), h("td", null, row.mainQuery ?? "—"), tableCell(row.current.clicks, "count", styles), tableCell(row.previous.clicks, "count", styles), deltaCell(row.deltas.clicks, "count", styles), tableCell(row.current.impressions, "count", styles), tableCell(row.previous.impressions, "count", styles), deltaCell(row.deltas.impressions, "count", styles), tableCell(row.current.ctr, "percent", styles), tableCell(row.previous.ctr, "percent", styles), deltaCell(row.deltas.ctr, "percent", styles), tableCell(row.current.position, "position", styles), tableCell(row.previous.position, "position", styles), deltaCell(row.deltas.position, "position", styles), tableCell(row.current.organicSessions, "count", styles), tableCell(row.previous.organicSessions, "count", styles), deltaCell(row.deltas.organicSessions, "count", styles), h("td", null, health?.httpStatus ?? "—"), h("td", null, health?.data?.title ?? "—"), h("td", null, health?.data?.h1 ?? "—"), h("td", null, health?.data?.canonical ?? "—"), h("td", null, health?.data?.robots ?? "—"), h("td", null, indexability), h("td", null, formatTimestamp(row.checkedAt), h("br"), `GSC: ${formatTimestamp(row.collectedAt)}`));
}

function tableRegion(label: string, caption: string, headers: readonly string[], rows: ReactNode[], styles: AnalyticsDashboardStyles, emptyMessage?: string): ReactNode { const bodyRows = rows.length ? rows : [h("tr", { key: "empty" }, h("td", { colSpan: headers.length }, emptyMessage ?? "対象期間にデータなし"))]; return h("div", { className: styles.scrollRegion, tabIndex: 0, "aria-label": label }, h("table", { className: styles.table }, h("caption", null, caption), h("thead", null, h("tr", null, ...headers.map((name) => h("th", { scope: "col", key: name }, name)))), h("tbody", null, ...bodyRows))); }

function seo(snapshot: AnalyticsSnapshot, styles: AnalyticsDashboardStyles): ReactNode {
  const top = snapshot.seo.topCounts;
  const topCards: ReadonlyArray<readonly [string, number | null]> = [["Top 10", top.top10], ["Top 20", top.top20], ["Top 30", top.top30]];
  const cards = topCards.map(([label, value]) => h("article", { className: styles.card, key: label }, h("p", { className: styles.cardTitle }, label), h("strong", { className: styles.value }, value === null ? "算出不可" : formatMetric(value, "count")), value === null ? h("p", { className: styles.muted }, "GSC行が完全ではないため算出不可") : null));
  const headers = ["エリア / パス", "主要クエリ", "クリック", "前クリック", "クリック差分", "表示回数", "前表示回数", "表示回数差分", "CTR", "前CTR", "CTR差分", "順位", "前順位", "順位差分", "Organic", "前Organic", "Organic差分", "HTTP", "title", "H1", "canonical", "robots", "indexability", "確認時刻"];
  return h(Fragment, null, h("section", { className: styles.kpiGrid, "aria-label": "SEO上位表示数" }, ...cards), h("section", { className: styles.section }, h("h3", null, "5つの重点エリア"), tableRegion("SEO重点エリア表", "スナップショット順の5重点エリア。掲載順位の差分は負の値が改善です。", headers, snapshot.seo.focusAreas.map((row) => seoRow(row, styles)), styles)));
}

function pages(snapshot: AnalyticsSnapshot, styles: AnalyticsDashboardStyles): ReactNode {
  const headers = ["パス", "セッション", "前セッション", "Organic", "前Organic", "Engaged", "前Engaged", "Engagement rate", "前Engagement rate", "GSC clicks", "前GSC clicks", "GSC impressions", "前GSC impressions", "GSC CTR", "前GSC CTR", "GSC position", "前GSC position"];
  const rows = snapshot.pages.map((row: SnapshotPage) => h("tr", { key: row.path }, h("th", { scope: "row", className: styles.path }, row.path), tableCell(row.current.sessions, "count", styles), tableCell(row.previous.sessions, "count", styles), tableCell(row.current.organicSessions, "count", styles), tableCell(row.previous.organicSessions, "count", styles), tableCell(row.current.engagedSessions ?? null, "count", styles), tableCell(row.previous.engagedSessions ?? null, "count", styles), tableCell(row.current.engagementRate ?? null, "percent", styles), tableCell(row.previous.engagementRate ?? null, "percent", styles), tableCell(row.current.gsc.clicks, "count", styles), tableCell(row.previous.gsc.clicks, "count", styles), tableCell(row.current.gsc.impressions, "count", styles), tableCell(row.previous.gsc.impressions, "count", styles), tableCell(row.current.gsc.ctr, "percent", styles), tableCell(row.previous.gsc.ctr, "percent", styles), tableCell(row.current.gsc.position, "position", styles), tableCell(row.previous.gsc.position, "position", styles)));
  return h("section", { className: styles.section }, h("h3", null, "ランディングページ"), tableRegion("ページ分析表", "Collectorが整形したページ別集計。activeUsersはページKPIとして表示しません。", headers, rows, styles, "ページ別のデータはありません。GA4またはGSCの状態を確認してください。"));
}

function siteHealth(snapshot: AnalyticsSnapshot, styles: AnalyticsDashboardStyles): ReactNode {
  if (snapshot.siteHealth === null) return h("p", { className: styles.unavailable }, `Site Health: ${sourceStateLabel(snapshot.sources.web.state)}。利用可能な検査結果はありません。`);
  const headers = ["URL / パス", "状態", "HTTP", "title", "H1", "canonical", "robots", "indexability / reason", "checkedAt"];
  const rows = snapshot.siteHealth.map((target) => h("tr", { key: target.path }, h("th", { scope: "row", className: styles.path }, target.path), h("td", null, badge(target.state, styles)), h("td", null, target.httpStatus ?? "—"), h("td", null, target.data?.title ?? "—"), h("td", null, target.data?.h1 ?? "—"), h("td", null, target.data?.canonical ?? "—"), h("td", null, target.data?.robots ?? "—"), h("td", null, target.data ? target.data.indexable === null ? target.data.indexabilityReason : target.data.indexable ? "indexable" : target.data.indexabilityReason : "算出不可"), h("td", null, formatTimestamp(target.checkedAt))));
  return h("section", { className: styles.section }, h("h3", null, "固定6 URL の検査結果"), tableRegion("Site Health検査結果表", "6つの固定検査対象。取得不能な項目を正常値で補いません。", headers, rows, styles));
}

function contentHealth(snapshot: AnalyticsSnapshot, styles: AnalyticsDashboardStyles): ReactNode {
  const data = snapshot.contentHealth;
  if (data === null) return h("p", { className: styles.unavailable }, `Content Health: ${sourceStateLabel(snapshot.sources.content.state)}。利用可能な地域集計はありません。`);
  const headers = ["地域", "公開店舗", "価格確認", "営業時間確認", "公式URL確認", "アクセス確認", "承認レビュー", "期限超過", "欠損率"];
  const rows = data.areas.map((area) => h("tr", { key: area.area.slug }, h("th", { scope: "row" }, area.area.name), tableCell(area.publishedShops, "count", styles), tableCell(area.verifiedPriceCount, "count", styles), tableCell(area.verifiedHoursCount, "count", styles), tableCell(area.verifiedOfficialUrlCount, "count", styles), tableCell(area.verifiedAccessCount, "count", styles), tableCell(area.approvedReviewCount, "count", styles), tableCell(area.staleConfirmedDateShopCount, "count", styles), h("td", { className: styles.numeric }, area.missingRate === null ? "算出不可" : h(Fragment, null, h("span", null, formatMetric(area.missingRate, "percent")), h("div", { className: styles.bar, style: { width: `${Math.min(area.missingRate * 100, 100)}%` }, "aria-hidden": true })))));
  return h("section", { className: styles.section }, h("h3", null, "地域コンテンツ健全性"), h("p", { className: styles.sectionLead }, `確認日の古さの閾値: ${data.staleAfterDays}日。個店・レビューの識別子は表示しません。`), tableRegion("地域コンテンツ健全性表", "公開済み店舗の確認済み情報と承認レビューの地域集計。", headers, rows, styles));
}

export default function AnalyticsDashboardView({ snapshot, view, styles }: Props): ReactNode {
  const requested = formatRange(snapshot.period.requested.current); const effective = formatRange(snapshot.sources.gsc.period?.effective.current ?? snapshot.period.effective.current);
  const body = view === "overview" ? overview(snapshot, styles) : view === "seo" ? seo(snapshot, styles) : view === "pages" ? pages(snapshot, styles) : view === "site-health" ? siteHealth(snapshot, styles) : contentHealth(snapshot, styles);
  const warnings = snapshot.warnings.length ? h("details", { className: styles.details }, h("summary", null, `収集に関する注意 (${snapshot.warnings.length})`), h("ul", { className: styles.warningList }, ...snapshot.warnings.map((warning) => h("li", { key: warning.code }, `code=${warning.code}`)))) : null;
  return h("div", { className: styles.page }, h("header", { className: styles.hero }, h("div", null, h("p", { className: styles.eyebrow }, `Analytics Snapshot v${snapshot.schemaVersion} · ${snapshot.timezone}`), h("h2", null, labels[view]), h("p", { className: styles.muted }, `要求期間: ${requested} ／ 生成: ${formatTimestamp(snapshot.generatedAt)}`, h("br"), `GSC有効期間: ${effective}`)), filterNav(snapshot.period.days, view, styles)), sourceStatus(snapshot, styles), body, warnings);
}
