import type { PeriodDays } from "./period";
import { dashboardConfig } from "./dashboard-config";
import { fetchSupabaseTable, isSupabaseReady } from "./dashboard-supabase";
import {
  parseDashboardNumber,
  resolveDashboardData,
  type DashboardDataResult,
  type DashboardDataSource,
} from "./dashboard/data-result";

const PROXY_URL = dashboardConfig.searchConsoleProxyUrl;
const SC_TABLES = dashboardConfig.supabase.tables;

export type SearchConsoleKeywordMetric = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsolePageMetric = {
  path: string;
  title: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleAreaMetric = {
  id: string;
  areaName: string;
  keywordCount: number;
  pageCount: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  top10Count: number;
  top20Count: number;
  status: "収集済み" | "データ不足";
  keywordSamples: string[];
};

export type FocusAreaConfig = {
  id: string;
  name: string;
  path: string;
  matchQueries: string[];
};

export const PRIORITY_AREAS: FocusAreaConfig[] = [
  {
    id: "shinosaka",
    name: "新大阪",
    path: "/area/shinosaka/",
    matchQueries: ["新大阪", "shinosaka", "shin-osaka", "shin osaka"],
  },
  {
    id: "umeda",
    name: "梅田",
    path: "/area/umeda/",
    matchQueries: ["梅田", "umeda"],
  },
  {
    id: "sakai-suji",
    name: "堺筋本町",
    path: "/area/sakaisujihonmachi/",
    matchQueries: ["堺筋本町", "堺筋", "堺筋本町駅"],
  },
  {
    id: "nihonbashi",
    name: "日本橋",
    path: "/area/nihonbashi/",
    matchQueries: ["日本橋", "nihonbashi"],
  },
  {
    id: "sakai",
    name: "堺",
    path: "/area/sakai/",
    matchQueries: ["堺", "sakai"],
  },
];

type SearchConsoleAction = "keywords" | "pages" | "areas";

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

function readText(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}

function isKeywordMetricList(value: unknown): value is SearchConsoleKeywordMetric[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.query === "string" && item.query.length > 0 &&
        typeof item.page === "string" && item.page.length > 0 &&
        isFiniteNumber(item.clicks) &&
        isFiniteNumber(item.impressions) &&
        isFiniteNumber(item.ctr) &&
        isFiniteNumber(item.position)
    )
  );
}

function isPageMetricList(value: unknown): value is SearchConsolePageMetric[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.path === "string" && item.path.length > 0 &&
        typeof item.title === "string" &&
        isFiniteNumber(item.clicks) &&
        isFiniteNumber(item.impressions) &&
        isFiniteNumber(item.ctr) &&
        isFiniteNumber(item.position)
    )
  );
}

function isAreaMetricList(value: unknown): value is SearchConsoleAreaMetric[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" && item.id.length > 0 &&
        typeof item.areaName === "string" && item.areaName.length > 0 &&
        isFiniteNumber(item.keywordCount) &&
        isFiniteNumber(item.pageCount) &&
        isFiniteNumber(item.impressions) &&
        isFiniteNumber(item.clicks) &&
        isFiniteNumber(item.ctr) &&
        isFiniteNumber(item.avgPosition) &&
        isFiniteNumber(item.top10Count) &&
        isFiniteNumber(item.top20Count) &&
        (item.status === "収集済み" || item.status === "データ不足") &&
        Array.isArray(item.keywordSamples) &&
        item.keywordSamples.every((sample) => typeof sample === "string")
    )
  );
}

function rowsToAreas(rows: Record<string, unknown>[]): SearchConsoleAreaMetric[] {
  const priorityAreaMap = new Map(PRIORITY_AREAS.map((area) => [area.id, area]));
  const grouped = new Map<string, SearchConsoleAreaMetric>();
  const positions = new Map<string, number[]>();

  for (const row of rows) {
    const areaId = String(row.area_id || row.areaId || "");
    const areaConfig = priorityAreaMap.get(areaId);
    if (!areaConfig) continue;

    const area = grouped.get(areaId) ?? {
      id: areaId,
      areaName: areaConfig.name,
      keywordCount: 0,
      pageCount: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      avgPosition: 0,
      top10Count: 0,
      top20Count: 0,
      status: "データ不足" as const,
      keywordSamples: [],
    };

    area.keywordCount += 1;
    area.pageCount += readNumber(row, ["pageCount", "page_count"]);
    area.impressions += readNumber(row, ["impressions", "imp"]);
    area.clicks += readNumber(row, ["clicks", "click_count"]);
    area.top10Count += readNumber(row, ["top10Count", "top10_count"]);
    area.top20Count += readNumber(row, ["top20Count", "top20_count"]);

    const position = readNumber(row, ["avgPosition", "position"]);
    if (position > 0) {
      area.status = "収集済み";
      positions.set(areaId, [...(positions.get(areaId) ?? []), position]);
      const sample = readText(row, ["query", "keyword"]);
      if (sample && area.keywordSamples.length < 2) area.keywordSamples.push(sample);
    }
    grouped.set(areaId, area);
  }

  for (const [areaId, values] of positions) {
    const area = grouped.get(areaId);
    if (!area || values.length === 0) continue;
    area.avgPosition = values.reduce((sum, value) => sum + value, 0) / values.length;
    area.ctr = area.impressions > 0 ? (area.clicks / area.impressions) * 100 : 0;
  }

  return PRIORITY_AREAS.flatMap((area) => {
    const value = grouped.get(area.id);
    return value ? [value] : [];
  });
}

async function fetchFromSupabase(action: SearchConsoleAction): Promise<unknown> {
  switch (action) {
    case "keywords": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(SC_TABLES.scKeywords);
      return rows
        .map((row) => ({
          query: readText(row, ["query", "keyword"]),
          page: readText(row, ["page", "url", "path"]),
          clicks: readNumber(row, ["clicks", "impressions_clicks"]),
          impressions: readNumber(row, ["impressions", "imp"]),
          ctr: readNumber(row, ["ctr", "ctrRate"]),
          position: readNumber(row, ["position", "avgPosition", "avg_position"]),
        }))
        .sort((a, b) => b.clicks - a.clicks);
    }
    case "pages": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(SC_TABLES.scPages);
      return rows
        .map((row) => ({
          path: readText(row, ["path", "url", "page"]),
          title: readText(row, ["title", "pageTitle", "path"]),
          clicks: readNumber(row, ["clicks", "impressions_clicks"]),
          impressions: readNumber(row, ["impressions", "imp"]),
          ctr: readNumber(row, ["ctr", "ctrRate"]),
          position: readNumber(row, ["position", "avgPosition", "avg_position"]),
        }))
        .sort((a, b) => b.clicks - a.clicks);
    }
    case "areas": {
      const rows = await fetchSupabaseTable<Record<string, unknown>>(SC_TABLES.scAreas);
      return rowsToAreas(rows);
    }
  }
}

async function fetchFromLegacyProxy(
  action: SearchConsoleAction,
  days: PeriodDays
): Promise<unknown> {
  const url = new URL(PROXY_URL, window.location.origin);
  url.searchParams.set("action", action);
  url.searchParams.set("days", String(days));
  if (action === "areas") {
    url.searchParams.set("focus", PRIORITY_AREAS.map((area) => area.id).join(","));
  }
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Search Console request failed: ${response.status}`);
  return response.json();
}

function searchConsoleSource(): DashboardDataSource {
  return dashboardConfig.dataSource === "supabase"
    ? "analytics-supabase"
    : "legacy-proxy";
}

async function fetchSearchConsoleResult<T>(
  action: SearchConsoleAction,
  days: PeriodDays,
  validate: (value: unknown) => value is T
): Promise<DashboardDataResult<T>> {
  const useSupabase = dashboardConfig.dataSource === "supabase";
  return resolveDashboardData({
    source: searchConsoleSource(),
    configured: useSupabase ? isSupabaseReady() : true,
    request: () =>
      useSupabase
        ? fetchFromSupabase(action)
        : fetchFromLegacyProxy(action, days),
    validate,
  });
}

export function fetchSearchConsoleKeywords(
  days: PeriodDays
): Promise<DashboardDataResult<SearchConsoleKeywordMetric[]>> {
  return fetchSearchConsoleResult("keywords", days, isKeywordMetricList);
}

export function fetchSearchConsolePages(
  days: PeriodDays
): Promise<DashboardDataResult<SearchConsolePageMetric[]>> {
  return fetchSearchConsoleResult("pages", days, isPageMetricList);
}

export function fetchSearchConsoleAreas(
  days: PeriodDays
): Promise<DashboardDataResult<SearchConsoleAreaMetric[]>> {
  return fetchSearchConsoleResult("areas", days, isAreaMetricList);
}

export function buildContentGapsFromSearchConsole(
  pages: SearchConsolePageMetric[],
  minImpressions = 120
): SearchConsolePageMetric[] {
  return pages
    .filter((page) => page.impressions >= minImpressions)
    .filter((page) => page.ctr < 4 || page.position > 20)
    .sort((a, b) => {
      const scoreA =
        a.impressions * Math.max(0.01, 1 - a.ctr / 100) *
        (a.position > 0 ? a.position / 10 : 1);
      const scoreB =
        b.impressions * Math.max(0.01, 1 - b.ctr / 100) *
        (b.position > 0 ? b.position / 10 : 1);
      return scoreB - scoreA;
    })
    .slice(0, 10);
}
