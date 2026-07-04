import type { PeriodDays } from "./period";
import { dashboardConfig } from "./dashboard-config";
import { fetchSupabaseTable, isSupabaseReady, toNumber } from "./dashboard-supabase";

const PROXY_URL =
  dashboardConfig.searchConsoleProxyUrl;

const SC_TABLES = dashboardConfig.supabase.tables;

async function fetchFromSupabase<T>(
  action: "keywords" | "pages" | "areas",
  fallback: T
): Promise<T> {
  if (!isSupabaseReady()) return fallback;

  try {
    switch (action) {
      case "keywords": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(SC_TABLES.scKeywords);
        return rows
          .map((row) => ({
            query: String(row.query || row.keyword || ""),
            page: String(row.page || row.url || row.path || ""),
            clicks: toNumber(row.clicks || row.impressions_clicks),
            impressions: toNumber(row.impressions || row.imp),
            ctr: toNumber(row.ctr || row.ctrRate),
            position: toNumber(row.position || row.avgPosition || row.avg_position),
          }))
          .sort((a, b) => b.clicks - a.clicks) as T;
      }
      case "pages": {
        const rows = await fetchSupabaseTable<Record<string, unknown>>(SC_TABLES.scPages);
        return rows
          .map((row) => ({
            path: String(row.path || row.url || row.page || ""),
            title: String(row.title || row.pageTitle || row.path || ""),
            clicks: toNumber(row.clicks || row.impressions_clicks),
            impressions: toNumber(row.impressions || row.imp),
            ctr: toNumber(row.ctr || row.ctrRate),
            position: toNumber(row.position || row.avgPosition || row.avg_position),
          }))
          .sort((a, b) => b.clicks - a.clicks) as T;
      }
      case "areas": {
        return rowsToAreas(await fetchSupabaseTable<Record<string, unknown>>(SC_TABLES.scAreas)) as T;
      }
      default:
        return fallback;
    }
  } catch {
    return fallback;
  }
}

function rowsToAreas(rows: Record<string, unknown>[]): SearchConsoleAreaMetric[] {
  const grouped: Record<string, SearchConsoleAreaMetric> = {};
  for (const area of PRIORITY_AREAS) {
    grouped[area.id] = {
      id: area.id,
      areaName: area.name,
      keywordCount: 0,
      pageCount: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      avgPosition: 0,
      top10Count: 0,
      top20Count: 0,
      status: "データ不足",
      keywordSamples: [],
    };
  }

  const posValues = new Map<string, number[]>();

  for (const row of rows) {
    const areaId = String(row.area_id || row.areaId || "");
    if (!grouped[areaId]) continue;
    const area = grouped[areaId];
    area.keywordCount += 1;
    area.pageCount += toNumber(row.pageCount || row.page_count || 1);
    area.impressions += toNumber(row.impressions || row.imp);
    area.clicks += toNumber(row.clicks || row.click_count || 0);
    area.top10Count += toNumber(row.top10Count || row.top10_count || 0);
    area.top20Count += toNumber(row.top20Count || row.top20_count || 0);
    const pos = toNumber(row.avgPosition || row.position);
    if (pos > 0) {
      area.status = "収集済み";
      posValues.set(areaId, [...(posValues.get(areaId) ?? []), pos]);
      const sample = String(row.query || row.keyword || "");
      if (sample && area.keywordSamples.length < 2) {
        area.keywordSamples.push(sample);
      }
    }
  }

  for (const [areaId, values] of posValues) {
    const area = grouped[areaId];
    if (!area || values.length === 0) continue;
    area.ctr = 0;
    area.avgPosition =
      values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    if (area.impressions > 0) {
      area.ctr = toNumber(area.clicks / area.impressions) * 100;
    }
  }

  return Object.values(grouped);
}

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
    matchQueries: ["堺筋本町", "堺筋", "堺筋本町駅", "堺筋"],
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

async function fetchScProxy<T>(
  action: "keywords" | "pages" | "areas",
  days: PeriodDays,
  fallback: T
): Promise<T> {
  if (dashboardConfig.dataSource === "supabase") {
    const supa = await fetchFromSupabase(action, fallback);
    if (supa !== fallback) return supa;
  }

  if (!dashboardConfig.enableLegacyProxyFallback && dashboardConfig.dataSource !== "legacy-proxy") {
    return fallback;
  }

  try {
    const url = new URL(PROXY_URL, window.location.origin);
    url.searchParams.set("action", action);
    url.searchParams.set("days", String(days));
    if (action === "areas") {
      url.searchParams.set("focus", PRIORITY_AREAS.map((area) => area.id).join(","));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return fallback;

    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function fetchSearchConsoleKeywords(
  days: PeriodDays
): Promise<SearchConsoleKeywordMetric[]> {
  return fetchScProxy("keywords", days, MOCK_SEARCH_KEYWORDS);
}

export async function fetchSearchConsolePages(
  days: PeriodDays
): Promise<SearchConsolePageMetric[]> {
  return fetchScProxy("pages", days, MOCK_SEARCH_PAGES);
}

export async function fetchSearchConsoleAreas(
  days: PeriodDays
): Promise<SearchConsoleAreaMetric[]> {
  return fetchScProxy("areas", days, MOCK_SEARCH_AREAS);
}

export function buildContentGapsFromSearchConsole(
  pages: SearchConsolePageMetric[],
  minImpressions = 120
): SearchConsolePageMetric[] {
  return pages
    .filter((p) => p.impressions >= minImpressions)
    .filter((p) => p.ctr < 4 || p.position > 20)
    .sort((a, b) => {
      const scoreA = b.impressions * Math.max(0.01, 1 - a.ctr / 100) * (a.position > 0 ? a.position / 10 : 1);
      const scoreB = a.impressions * Math.max(0.01, 1 - b.ctr / 100) * (b.position > 0 ? b.position / 10 : 1);
      return scoreA - scoreB;
    })
    .slice(0, 10);
}

const MOCK_SEARCH_KEYWORDS: SearchConsoleKeywordMetric[] = [
  {
    query: "大阪 メンズエステ 口コミ",
    page: "/area/osaka/",
    clicks: 120,
    impressions: 1450,
    ctr: 8.28,
    position: 7.2,
  },
  {
    query: "新大阪 メンズエステ",
    page: "/area/shinosaka/",
    clicks: 84,
    impressions: 940,
    ctr: 8.94,
    position: 5.8,
  },
  {
    query: "梅田 メンズエステ",
    page: "/area/umeda/",
    clicks: 64,
    impressions: 980,
    ctr: 6.53,
    position: 9.1,
  },
  {
    query: "堺筋本町 メンズエステ",
    page: "/area/sakaisujihonmachi/",
    clicks: 22,
    impressions: 260,
    ctr: 8.46,
    position: 15.4,
  },
  {
    query: "日本橋 メンズエステ",
    page: "/area/nihonbashi/",
    clicks: 130,
    impressions: 1120,
    ctr: 11.61,
    position: 4.4,
  },
  {
    query: "堺 メンズエステ",
    page: "/area/sakai/",
    clicks: 42,
    impressions: 460,
    ctr: 9.13,
    position: 12.8,
  },
];

const MOCK_SEARCH_PAGES: SearchConsolePageMetric[] = MOCK_SEARCH_KEYWORDS.map((item) => ({
  path: item.page,
  title: item.query,
  clicks: item.clicks,
  impressions: item.impressions,
  ctr: item.ctr,
  position: item.position,
}));

const MOCK_SEARCH_AREAS: SearchConsoleAreaMetric[] = [
  {
    id: "shinosaka",
    areaName: "新大阪",
    keywordCount: 42,
    pageCount: 18,
    impressions: 940,
    clicks: 84,
    ctr: 8.94,
    avgPosition: 5.8,
    top10Count: 19,
    top20Count: 32,
    status: "収集済み",
    keywordSamples: ["新大阪 メンズエステ", "新大阪 メンズエステ 料金"],
  },
  {
    id: "umeda",
    areaName: "梅田",
    keywordCount: 56,
    pageCount: 24,
    impressions: 980,
    clicks: 64,
    ctr: 6.53,
    avgPosition: 9.1,
    top10Count: 16,
    top20Count: 38,
    status: "収集済み",
    keywordSamples: ["梅田 メンズエステ", "梅田 エステ 口コミ"],
  },
  {
    id: "sakai-suji",
    areaName: "堺筋本町",
    keywordCount: 20,
    pageCount: 8,
    impressions: 260,
    clicks: 22,
    ctr: 8.46,
    avgPosition: 15.4,
    top10Count: 3,
    top20Count: 11,
    status: "収集済み",
    keywordSamples: ["堺筋本町 メンズエステ", "堺筋本町 口コミ"],
  },
  {
    id: "nihonbashi",
    areaName: "日本橋",
    keywordCount: 74,
    pageCount: 28,
    impressions: 1120,
    clicks: 130,
    ctr: 11.61,
    avgPosition: 4.4,
    top10Count: 49,
    top20Count: 66,
    status: "収集済み",
    keywordSamples: ["日本橋 メンズエステ", "大阪 日本橋 メンズエステ"],
  },
  {
    id: "sakai",
    areaName: "堺",
    keywordCount: 33,
    pageCount: 12,
    impressions: 460,
    clicks: 42,
    ctr: 9.13,
    avgPosition: 12.8,
    top10Count: 8,
    top20Count: 19,
    status: "収集済み",
    keywordSamples: ["堺 メンズエステ", "堺 エステ おすすめ"],
  },
];
