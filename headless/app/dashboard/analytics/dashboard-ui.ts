import type { AnalyticsSourceState } from "@/lib/analytics/result";

export const dashboardViews = ["overview", "seo", "pages", "site-health", "content-health"] as const;
export type DashboardView = (typeof dashboardViews)[number];
export type DashboardParams = Record<string, string | string[] | undefined>;

export type ParsedDashboardParams =
  | { ok: true; days: 7 | 28; view: DashboardView }
  | { ok: false; message: string };

function one(value: string | string[] | undefined): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : value.length === 1 ? value[0] : null;
}

export function parseAnalyticsDashboardParams(params: DashboardParams): ParsedDashboardParams {
  if (Object.keys(params).some((key) => key !== "period" && key !== "view")) return { ok: false, message: "不明な表示条件です。" };
  const period = one(params.period);
  const view = one(params.view);
  if (period === null || view === null) return { ok: false, message: "表示条件を重複指定できません。" };
  const days = period === undefined ? 7 : period === "7" ? 7 : period === "28" ? 28 : null;
  if (days === null) return { ok: false, message: "期間は7日または28日のみ選択できます。" };
  const selected = view === undefined ? "overview" : dashboardViews.includes(view as DashboardView) ? view as DashboardView : null;
  if (selected === null) return { ok: false, message: "表示ビューが無効です。" };
  return { ok: true, days, view: selected };
}

export function analyticsDashboardHref(days: 7 | 28, view: DashboardView): string {
  return `/dashboard/analytics/?period=${days}&view=${view}`;
}

export function sourceStateLabel(state: AnalyticsSourceState): string {
  return {
    ok: "取得済み",
    partial: "一部取得",
    no_data: "対象期間にデータなし",
    not_configured: "未設定",
    auth_error: "取得エラー（認証）",
    api_error: "取得エラー（API）",
    invalid_response: "取得エラー（応答）",
    timeout: "取得エラー（タイムアウト）",
  }[state];
}

export type MetricKind = "count" | "percent" | "position";

export function formatMetric(value: number | null, kind: MetricKind): string {
  if (value === null) return "—";
  if (kind === "percent") return `${(value * 100).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  if (kind === "position") return value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return value.toLocaleString("ja-JP");
}

export function formatDelta(value: number | null, kind: MetricKind): string {
  if (value === null) return "—";
  if (kind === "position") return value === 0 ? "±0.0" : `${Math.abs(value).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${value < 0 ? "改善" : "悪化"}`;
  const formatted = formatMetric(Math.abs(value), kind);
  return `${value >= 0 ? "+" : "−"}${formatted}`;
}

export function formatRange(range: { startDate: string; endDate: string }): string {
  return `${range.startDate} 〜 ${range.endDate}`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo",
  }).format(parsed);
}
