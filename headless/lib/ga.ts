import type { PeriodDays } from "./period";
import { dashboardConfig } from "./dashboard-config";
import { fetchSupabaseTable, isSupabaseReady, toNumber } from "./dashboard-supabase";

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
  _mock?: boolean;
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

const PROXY_URL =
  dashboardConfig.gaProxyUrl;

const GA_TABLES = dashboardConfig.supabase.tables;

function getDateRangeLimit(days: PeriodDays): number {
  if (days === "all") {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.max(1, Math.min(366, Number(days)));
}

function filterRecentByDate<T extends { date: string }>(items: T[], days: PeriodDays): T[] {
  const n = getDateRangeLimit(days);
  if (days === "all") return items;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (n - 1));
  const target = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  return items.filter((item) => {
    const parsed = new Date(item.date);
    return !Number.isNaN(parsed.getTime()) && parsed >= target;
  });
}

async function fetchFromSupabase<T>(action: string, days: PeriodDays, fallback: T): Promise<T> {
  if (!isSupabaseReady()) return fallback;
  try {
    switch (action) {
      case "daily": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaDaily);
        const daily = rows
          .map((row) => {
            const date = String(row.date || row.day || row.report_date || "");
            return {
              date,
              pageviews: toNumber(row.pageviews || row.views || row.page_views),
              sessions: toNumber(row.sessions || row.visits || row.session_count),
            };
          })
          .filter((d) => d.date)
          .sort((a, b) => a.date.localeCompare(b.date));
        return filterRecentByDate(daily, days) as T;
      }
      case "totals": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaTotals);
        if (rows.length === 0) return fallback;
        const totals = rows.reduce(
          (acc, row) => {
            acc.pageviews += toNumber(row.pageviews || row.views || row.total_pageviews);
            acc.sessions += toNumber(row.sessions || row.visits || row.total_sessions);
            acc.bounceRate += toNumber(row.bounceRate || row.bounce_rate || row.bounce);
            acc.avgDuration += toNumber(row.avgDuration || row.averageSessionDuration || row.avg_duration);
            acc.ctaClicks += toNumber(row.ctaClicks || row.cta_clicks || row.event_count);
            return acc;
          },
          { pageviews: 0, sessions: 0, bounceRate: 0, avgDuration: 0, ctaClicks: 0, count: 0 }
        );
        const count = Math.max(1, rows.length);
        return {
          pageviews: totals.pageviews,
          sessions: totals.sessions,
          bounceRate: totals.bounceRate / count,
          avgDuration: Math.round(totals.avgDuration / count),
          ctaClicks: totals.ctaClicks,
        } as T;
      }
      case "pages": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaPages);
        return rows
          .map((row) => ({
            path: String(row.path || row.page || row.pagePath || ""),
            title: String(row.title || row.page_title || ""),
            pageviews: toNumber(row.pageviews || row.views || row.screenPageViews),
            sessions: toNumber(row.sessions || row.visits || row.session_count),
          }))
          .sort((a, b) => b.pageviews - a.pageviews)
          .slice(0, 10) as T;
      }
      case "creatives": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaCreatives);
        return rows
          .map((row) => ({
            creative: String(row.creative || row.sessionManualAdContent || "(未設定)"),
            campaign: String(row.campaign || row.sessionCampaignName || "(未設定)"),
            pageviews: toNumber(row.pageviews || row.views || row.screenPageViews),
            sessions: toNumber(row.sessions || row.visits || row.session_count),
            users: toNumber(row.users || row.totalUsers || row.unique_users),
            bounceRate: toNumber(row.bounceRate || row.bounce_rate || row.bounceRatePercent),
            avgDuration: toNumber(row.avgDuration || row.averageSessionDuration || row.avg_duration),
          }))
          .sort((a, b) => b.pageviews - a.pageviews)
          .slice(0, 10) as T;
      }
      case "cta": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(GA_TABLES.gaCta);
        const limited = rows
          .map((row) => ({
            eventName: String(row.eventName || row.event_name || row.name || ""),
            count: toNumber(row.count || row.eventCount || row.events),
            sessions: toNumber(row.sessions || row.visits || row.userCount),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12);
        return limited as T;
      }
      default:
        return fallback;
    }
  } catch {
    return fallback;
  }
}

async function fetchProxy<T>(
  action: string,
  days: PeriodDays,
  fallback: T
): Promise<T> {
  if (dashboardConfig.dataSource === "supabase") {
    const supa = await fetchFromSupabase<T>(action, days, fallback);
    if (supa !== fallback) return supa;
  }

  if (!dashboardConfig.enableLegacyProxyFallback && dashboardConfig.dataSource !== "legacy-proxy") {
    return fallback;
  }

  try {
    const res = await fetch(
      `${PROXY_URL}?action=${action}&days=${encodeURIComponent(String(days))}`,
      { cache: "no-store" }
    );
    if (!res.ok) return fallback;
    const json = await res.json();
    return json as T;
  } catch {
    return fallback;
  }
}

function mockDaily(days: PeriodDays): DailyMetric[] {
  const count = days === "all" ? 90 : days;
  const data: DailyMetric[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 200 : 0;
    const noise = Math.sin(i * 0.7) * 150 + Math.cos(i * 1.3) * 80;
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    data.push({
      date: `${y}${m}${day}`,
      pageviews: Math.max(
        200,
        Math.round(900 + noise + weekend + (Math.random() - 0.5) * 100)
      ),
      sessions: Math.max(
        130,
        Math.round(
          620 + noise * 0.7 + weekend * 0.7 + (Math.random() - 0.5) * 60
        )
      ),
    });
  }
  return data;
}

function mockTotals(days: PeriodDays): Totals {
  const daily = mockDaily(days);
  const pageviews = daily.reduce((s, d) => s + d.pageviews, 0);
  const sessions = daily.reduce((s, d) => s + d.sessions, 0);
  return {
    pageviews,
    sessions,
    bounceRate: 42.3,
    avgDuration: 187,
    ctaClicks: 320,
    _mock: true,
  };
}

const MOCK_PAGES: PageMetric[] = [
  { path: "/shop/genie/", title: "ジーニー（渋谷）", pageviews: 3240, sessions: 2180 },
  { path: "/shop/relax-men/", title: "RELAX MEN（新宿）", pageviews: 2870, sessions: 1920 },
  { path: "/shop/bliss-tokyo/", title: "BLISS TOKYO", pageviews: 2310, sessions: 1540 },
  { path: "/area/tokyo/", title: "東京エリアのメンズエステ", pageviews: 2100, sessions: 1480 },
  { path: "/shop/angel-spa/", title: "エンジェルスパ（池袋）", pageviews: 1890, sessions: 1260 },
  { path: "/area/osaka/", title: "大阪エリアのメンズエステ", pageviews: 1720, sessions: 1150 },
  { path: "/shop/serene-touch/", title: "セリーンタッチ（梅田）", pageviews: 1540, sessions: 1030 },
  { path: "/ranking/", title: "人気ランキング", pageviews: 1380, sessions: 920 },
  { path: "/shop/pure-hands/", title: "ピュアハンズ（横浜）", pageviews: 1260, sessions: 840 },
  { path: "/", title: "メンズエステ口コミランキング TOP", pageviews: 1140, sessions: 760 },
];

const MOCK_CREATIVES: CreativeMetric[] = [
  { creative: "バナーA_日本橋", campaign: "Search_関西", pageviews: 4820, sessions: 3210, users: 2890, bounceRate: 38.4, avgDuration: 204 },
  { creative: "テキスト_初回割", campaign: "Search_関西", pageviews: 3910, sessions: 2680, users: 2410, bounceRate: 41.2, avgDuration: 178 },
  { creative: "リスティング_口コミ訴求", campaign: "Search_東京", pageviews: 3540, sessions: 2390, users: 2150, bounceRate: 44.8, avgDuration: 165 },
  { creative: "P-MAX_動画01", campaign: "PMAX_全国", pageviews: 2980, sessions: 2100, users: 1980, bounceRate: 52.1, avgDuration: 142 },
  { creative: "ディスプレイ_300x250", campaign: "Display_リターゲ", pageviews: 2210, sessions: 1540, users: 1420, bounceRate: 58.6, avgDuration: 118 },
  { creative: "バナーB_梅田", campaign: "Search_関西", pageviews: 1870, sessions: 1290, users: 1180, bounceRate: 46.3, avgDuration: 171 },
  { creative: "テキスト_24h営業", campaign: "Search_名古屋", pageviews: 1620, sessions: 1120, users: 1040, bounceRate: 49.7, avgDuration: 156 },
  { creative: "YouTube_15s", campaign: "Video_認知", pageviews: 1340, sessions: 980, users: 920, bounceRate: 61.2, avgDuration: 95 },
];

const MOCK_CTA: CtaMetric[] = [
  { eventName: "line_click", sessions: 320, count: 122 },
  { eventName: "tel_click", sessions: 190, count: 96 },
  { eventName: "official_click", sessions: 150, count: 74 },
  { eventName: "coupon_click", sessions: 80, count: 39 },
  { eventName: "inquiry_click", sessions: 45, count: 28 },
];

export async function fetchGA4Daily(days: PeriodDays): Promise<DailyMetric[]> {
  return fetchProxy<DailyMetric[]>("daily", days, mockDaily(days));
}

export async function fetchGA4Totals(days: PeriodDays): Promise<Totals> {
  return fetchProxy<Totals>("totals", days, mockTotals(days));
}

export async function fetchGA4Pages(days: PeriodDays): Promise<PageMetric[]> {
  return fetchProxy<PageMetric[]>("pages", days, MOCK_PAGES);
}

export async function fetchGA4Creatives(days: PeriodDays): Promise<CreativeMetric[]> {
  return fetchProxy<CreativeMetric[]>("creatives", days, MOCK_CREATIVES);
}

export async function fetchGA4Cta(days: PeriodDays): Promise<CtaMetric[]> {
  return fetchProxy<CtaMetric[]>("cta", days, MOCK_CTA);
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
