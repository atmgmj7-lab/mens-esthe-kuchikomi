import type { PeriodDays } from "./period";
import { dashboardConfig } from "./dashboard-config";
import { fetchSupabaseTable, isSupabaseReady } from "./dashboard-supabase";
import {
  parseDashboardNumber,
  resolveDashboardData,
  type DashboardDataResult,
  type DashboardDataSource,
} from "./dashboard/data-result";

export type DailyMetric = {
  date: string;
  pageviews: number;
  sessions: number;
};

export type Totals = {
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
  ctaClicks: number;
};

export type PageMetric = {
  path: string;
  title: string;
  pageviews: number;
  sessions: number;
};

export type CreativeMetric = {
  creative: string;
  campaign: string;
  pageviews: number;
  sessions: number;
  users: number;
  bounceRate: number;
  avgDuration: number;
};

export type CtaMetric = {
  eventName: string;
  sessions: number;
  count: number;
};

type GaAction = "daily" | "totals" | "pages" | "creatives" | "cta";

const PROXY_URL = dashboardConfig.gaProxyUrl;
const GA_TABLES = dashboardConfig.supabase.tables;

function getDateRangeLimit(days: PeriodDays): number {
  if (days === "all") return Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.min(366, Number(days)));
}

function filterRecentByDate<T extends { date: string }>(
  items: T[],
  days: PeriodDays
): T[] {
  const n = getDateRangeLimit(days);
  if (days === "all") return items;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (n - 1));
  const target = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  return items.filter((item) => {
    const parsed = new Date(item.date);
    return Number.isNaN(parsed.getTime()) || parsed >= target;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readNumber(
  row: Record<string, unknown>,
  keys: string[]
): number {
  for (const key of keys) {
    const value = parseDashboardNumber(row[key]);
    if (value !== null) return value;
  }
  return Number.NaN;
}

function readText(
  row: Record<string, unknown>,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return fallback;
}

function isMetricList<T>(
  value: unknown,
  validateItem: (item: Record<string, unknown>) => boolean
): value is T[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && validateItem(item));
}

function isDailyMetricList(value: unknown): value is DailyMetric[] {
  return isMetricList<DailyMetric>(
    value,
    (item) =>
      typeof item.date === "string" && item.date.length > 0 &&
      isFiniteNumber(item.pageviews) &&
      isFiniteNumber(item.sessions)
  );
}

function isTotals(value: unknown): value is Totals {
  return (
    isRecord(value) &&
    isFiniteNumber(value.pageviews) &&
    isFiniteNumber(value.sessions) &&
    isFiniteNumber(value.bounceRate) &&
    isFiniteNumber(value.avgDuration) &&
    isFiniteNumber(value.ctaClicks)
  );
}

function isPageMetricList(value: unknown): value is PageMetric[] {
  return isMetricList<PageMetric>(
    value,
    (item) =>
      typeof item.path === "string" && item.path.length > 0 &&
      typeof item.title === "string" &&
      isFiniteNumber(item.pageviews) &&
      isFiniteNumber(item.sessions)
  );
}

function isCreativeMetricList(value: unknown): value is CreativeMetric[] {
  return isMetricList<CreativeMetric>(
    value,
    (item) =>
      typeof item.creative === "string" &&
      typeof item.campaign === "string" &&
      isFiniteNumber(item.pageviews) &&
      isFiniteNumber(item.sessions) &&
      isFiniteNumber(item.users) &&
      isFiniteNumber(item.bounceRate) &&
      isFiniteNumber(item.avgDuration)
  );
}

function isCtaMetricList(value: unknown): value is CtaMetric[] {
  return isMetricList<CtaMetric>(
    value,
    (item) =>
      typeof item.eventName === "string" && item.eventName.length > 0 &&
      isFiniteNumber(item.count) &&
      isFiniteNumber(item.sessions)
  );
}

async function fetchFromSupabase(
  action: GaAction,
  days: PeriodDays
): Promise<unknown> {
  switch (action) {
    case "daily": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaDaily);
      const daily = rows
        .map((row) => ({
          date: readText(row, ["date", "day", "report_date"]),
          pageviews: readNumber(row, ["pageviews", "views", "page_views"]),
          sessions: readNumber(row, ["sessions", "visits", "session_count"]),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return filterRecentByDate(daily, days);
    }
    case "totals": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaTotals);
      if (rows.length === 0) {
        return {
          pageviews: 0,
          sessions: 0,
          bounceRate: 0,
          avgDuration: 0,
          ctaClicks: 0,
        } satisfies Totals;
      }

      const totals = rows.reduce<Totals>(
        (sum, row) => ({
          pageviews: sum.pageviews + readNumber(row, ["pageviews", "views", "total_pageviews"]),
          sessions: sum.sessions + readNumber(row, ["sessions", "visits", "total_sessions"]),
          bounceRate: sum.bounceRate + readNumber(row, ["bounceRate", "bounce_rate", "bounce"]),
          avgDuration:
            sum.avgDuration +
            readNumber(row, ["avgDuration", "averageSessionDuration", "avg_duration"]),
          ctaClicks: sum.ctaClicks + readNumber(row, ["ctaClicks", "cta_clicks", "event_count"]),
        }),
        { pageviews: 0, sessions: 0, bounceRate: 0, avgDuration: 0, ctaClicks: 0 }
      );
      return {
        ...totals,
        bounceRate: totals.bounceRate / rows.length,
        avgDuration: Math.round(totals.avgDuration / rows.length),
      } satisfies Totals;
    }
    case "pages": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaPages);
      return rows
        .map((row) => ({
          path: readText(row, ["path", "page", "pagePath"]),
          title: readText(row, ["title", "page_title"]),
          pageviews: readNumber(row, ["pageviews", "views", "screenPageViews"]),
          sessions: readNumber(row, ["sessions", "visits", "session_count"]),
        }))
        .sort((a, b) => b.pageviews - a.pageviews)
        .slice(0, 10);
    }
    case "creatives": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaCreatives);
      return rows
        .map((row) => ({
          creative: readText(row, ["creative", "sessionManualAdContent"], "(未設定)"),
          campaign: readText(row, ["campaign", "sessionCampaignName"], "(未設定)"),
          pageviews: readNumber(row, ["pageviews", "views", "screenPageViews"]),
          sessions: readNumber(row, ["sessions", "visits", "session_count"]),
          users: readNumber(row, ["users", "totalUsers", "unique_users"]),
          bounceRate: readNumber(row, ["bounceRate", "bounce_rate", "bounceRatePercent"]),
          avgDuration: readNumber(row, ["avgDuration", "averageSessionDuration", "avg_duration"]),
        }))
        .sort((a, b) => b.pageviews - a.pageviews)
        .slice(0, 10);
    }
    case "cta": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaCta);
      return rows
        .map((row) => ({
          eventName: readText(row, ["eventName", "event_name", "name"]),
          count: readNumber(row, ["count", "eventCount", "events"]),
          sessions: readNumber(row, ["sessions", "visits", "userCount"]),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
    }
  }
}

async function fetchFromLegacyProxy(action: GaAction, days: PeriodDays): Promise<unknown> {
  const response = await fetch(
    `${PROXY_URL}?action=${action}&days=${encodeURIComponent(String(days))}`,
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error(`GA4 request failed: ${response.status}`);
  return response.json();
}

function gaSource(): DashboardDataSource {
  return dashboardConfig.dataSource === "supabase"
    ? "analytics-supabase"
    : "legacy-proxy";
}

function isGaSourceConfigured(): boolean {
  return dashboardConfig.dataSource === "supabase" ? isSupabaseReady() : true;
}

async function fetchGaResult<T>(
  action: GaAction,
  days: PeriodDays,
  validate: (value: unknown) => value is T
): Promise<DashboardDataResult<T>> {
  const useSupabase = dashboardConfig.dataSource === "supabase";
  return resolveDashboardData({
    source: gaSource(),
    configured: isGaSourceConfigured(),
    request: () =>
      useSupabase
        ? fetchFromSupabase(action, days)
        : fetchFromLegacyProxy(action, days),
    validate,
  });
}

export function fetchGA4Daily(
  days: PeriodDays
): Promise<DashboardDataResult<DailyMetric[]>> {
  return fetchGaResult("daily", days, isDailyMetricList);
}

export function fetchGA4Totals(
  days: PeriodDays
): Promise<DashboardDataResult<Totals>> {
  return fetchGaResult("totals", days, isTotals);
}

export function fetchGA4Pages(
  days: PeriodDays
): Promise<DashboardDataResult<PageMetric[]>> {
  return fetchGaResult("pages", days, isPageMetricList);
}

export function fetchGA4Creatives(
  days: PeriodDays
): Promise<DashboardDataResult<CreativeMetric[]>> {
  return fetchGaResult("creatives", days, isCreativeMetricList);
}

export function fetchGA4Cta(
  days: PeriodDays
): Promise<DashboardDataResult<CtaMetric[]>> {
  return fetchGaResult("cta", days, isCtaMetricList);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
