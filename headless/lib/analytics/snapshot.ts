import "server-only";

import { createWordPressContentService } from "./content-service";
import { collectGa4, type Ga4AnalyticsData, type Ga4LandingPage } from "./ga4";
import { collectGsc, type GscAnalyticsData, type GscDimensionRow, type GscMetric } from "./gsc";
import { buildAnalyticsPeriod, type AnalyticsDays, type AnalyticsPeriod } from "./period";
import { analyticsFailure, type AnalyticsSourceResult, type AnalyticsSourceState, type AnalyticsWarning } from "./result";
import { collectSiteHealth, type SiteHealthData } from "./site-health";
import type { ContentHealthData } from "./content-service";

const ORIGIN = "https://mens-esthe-kuchikomi.com";
const FOCUS_AREAS = [
  ["堺東", "/area/sakai/"],
  ["新大阪", "/area/shinosaka/"],
  ["大阪日本橋", "/area/nihonbashi/"],
  ["堺筋本町", "/area/sakaisujihonmachi/"],
  ["梅田", "/area/umeda/"],
] as const;

type NullableMetrics = { sessions: number | null; activeUsers?: number | null; engagedSessions?: number | null; engagementRate?: number | null; keyEvents?: number | null };
type NullableGsc = { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null };
type SnapshotWarning = AnalyticsWarning;

export type AnalyticsSnapshot = Readonly<{
  schemaVersion: "1.0.0";
  timezone: "Asia/Tokyo";
  generatedAt: string;
  collectedAt: string;
  period: AnalyticsPeriod;
  sources: Record<"ga4" | "gsc" | "web" | "content", Readonly<{ state: AnalyticsSourceState; collectedAt: string; warnings: readonly SnapshotWarning[]; period?: AnalyticsPeriod }>>;
  overview: Readonly<{
    current: Readonly<{ sessions: number | null; activeUsers: number | null; engagedSessions: number | null; engagementRate: number | null; keyEvents: number | null; organicSessions: number | null; gsc: NullableGsc }>;
    previous: Readonly<{ sessions: number | null; activeUsers: number | null; engagedSessions: number | null; engagementRate: number | null; keyEvents: number | null; organicSessions: number | null; gsc: NullableGsc }>;
    deltas: Readonly<{ sessions: number | null; activeUsers: number | null; engagedSessions: number | null; engagementRate: number | null; keyEvents: number | null; organicSessions: number | null; clicks: number | null; impressions: number | null; ctr: number | null; position: number | null }>;
  }>;
  seo: Readonly<{ focusAreas: readonly FocusArea[]; topCounts: Readonly<{ top10: number | null; top20: number | null; top30: number | null }> }>;
  pages: readonly SnapshotPage[];
  siteHealth: SiteHealthData["targets"] | null;
  contentHealth: ContentHealthData | null;
  warnings: readonly SnapshotWarning[];
}>;

export type FocusArea = Readonly<{
  name: string; path: string; mainQuery: string | null;
  current: NullableGsc & { organicSessions: number | null };
  previous: NullableGsc & { organicSessions: number | null };
  deltas: Readonly<{ clicks: number | null; impressions: number | null; ctr: number | null; position: number | null; organicSessions: number | null }>;
  siteHealth: SiteHealthData["targets"][number] | null;
  checkedAt: string | null;
  collectedAt: string | null;
}>;

export type SnapshotPage = Readonly<{
  path: string;
  current: Readonly<NullableMetrics & { organicSessions: number | null; gsc: NullableGsc }>;
  previous: Readonly<NullableMetrics & { organicSessions: number | null; gsc: NullableGsc }>;
}>;

export type SnapshotSources = Readonly<{
  collectGa4: (options: { period: AnalyticsPeriod; now: () => Date }) => Promise<AnalyticsSourceResult<Ga4AnalyticsData>>;
  collectGsc: (options: { period: AnalyticsPeriod; now: () => Date }) => Promise<AnalyticsSourceResult<GscAnalyticsData>>;
  collectSiteHealth: (options: { now: () => Date }) => Promise<AnalyticsSourceResult<SiteHealthData>>;
  getContentHealth: () => Promise<AnalyticsSourceResult<ContentHealthData>>;
}>;

export type CollectAnalyticsSnapshotOptions = Readonly<{ days: AnalyticsDays; now?: Date; sources?: SnapshotSources }>;

function safeWarning(value: AnalyticsWarning): SnapshotWarning {
  const code = typeof value?.code === "string" && /^[a-z0-9_:-]+$/i.test(value.code) ? value.code : "analytics_sanitized_warning";
  return { code, message: `code=${code}` };
}

function sourceFailure<T>(collectedAt: string): AnalyticsSourceResult<T> {
  return analyticsFailure("api_error", { collectedAt, warnings: [{ code: "analytics_source_exception", message: "state=api_error; code=analytics_source_exception" }] });
}

async function isolate<T>(call: () => Promise<AnalyticsSourceResult<T>>, collectedAt: string): Promise<AnalyticsSourceResult<T>> {
  try { return await call(); } catch { return sourceFailure<T>(collectedAt); }
}

function summary<T>(result: AnalyticsSourceResult<T>, period?: AnalyticsPeriod) {
  return { state: result.state, collectedAt: result.collectedAt, warnings: result.warnings.map(safeWarning), ...(period ? { period } : {}) } as const;
}

function value<T>(result: AnalyticsSourceResult<T>): T | null { return result.data; }
function delta(current: number | null, previous: number | null): number | null { return current === null || previous === null ? null : current - previous; }
function nullGsc(): NullableGsc { return { clicks: null, impressions: null, ctr: null, position: null }; }
function gscMetric(metric: GscMetric | null): NullableGsc { return metric ? { clicks: metric.clicks, impressions: metric.impressions, ctr: metric.ctr, position: metric.position } : nullGsc(); }

function normalizePath(input: string, requireAbsolute = false): string | null {
  if (typeof input !== "string" || input.trim() !== input || input === "" || input.includes("\\")) return null;
  if (requireAbsolute && !input.startsWith(ORIGIN)) return null;
  if (!requireAbsolute && !input.startsWith("/") || input.startsWith("//")) return null;
  try {
    const url = new URL(input, ORIGIN);
    if (url.origin !== ORIGIN || url.username || url.password || url.protocol !== "https:") return null;
    const decoded = decodeURIComponent(url.pathname);
    if (!decoded.startsWith("/") || decoded.includes("\u0000") || decoded.split("/").includes("..")) return null;
    return decoded === "/" ? "/" : `${decoded.replace(/\/+$/u, "")}/`;
  } catch { return null; }
}

type PageTotals = { sessions: number; activeUsers: number; engagedSessions: number; keyEvents: number };
function mergeGa4(rows: Ga4LandingPage[] | null, warnings: SnapshotWarning[]): Map<string, PageTotals> {
  const map = new Map<string, PageTotals>();
  for (const row of rows ?? []) {
    const path = normalizePath(row.landingPage);
    if (!path) { warnings.push({ code: "snapshot_ga4_unsafe_landing_path", message: "code=snapshot_ga4_unsafe_landing_path" }); continue; }
    const existing = map.get(path) ?? { sessions: 0, activeUsers: 0, engagedSessions: 0, keyEvents: 0 };
    existing.sessions += row.sessions; existing.activeUsers += row.activeUsers; existing.engagedSessions += row.engagedSessions; existing.keyEvents += row.keyEvents;
    map.set(path, existing);
  }
  return map;
}

function pairData<T>(pair: { current: AnalyticsSourceResult<T>; previous: AnalyticsSourceResult<T> }): [T | null, T | null] { return [value(pair.current), value(pair.previous)]; }

function gscPages(rows: GscAnalyticsData["pages"]["current"]["data"], warnings: SnapshotWarning[]): Map<string, GscMetric> {
  const map = new Map<string, GscMetric>();
  const collisions = new Set<string>();
  for (const row of rows?.rows ?? []) {
    const path = normalizePath(row.keys[0], true);
    if (!path) { warnings.push({ code: "snapshot_gsc_unsafe_or_duplicate_page", message: "code=snapshot_gsc_unsafe_or_duplicate_page" }); continue; }
    if (collisions.has(path)) continue;
    if (map.has(path)) {
      map.delete(path);
      collisions.add(path);
      warnings.push({ code: "snapshot_gsc_normalization_collision_omitted", message: "code=snapshot_gsc_normalization_collision_omitted" });
      continue;
    }
    map.set(path, { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position });
  }
  return map;
}

function metricForPath(rows: Map<string, PageTotals>, path: string): NullableMetrics {
  const data = rows.get(path);
  return data ? { sessions: data.sessions, activeUsers: data.activeUsers, engagedSessions: data.engagedSessions, engagementRate: data.sessions === 0 ? 0 : data.engagedSessions / data.sessions, keyEvents: data.keyEvents } : { sessions: null, activeUsers: null, engagedSessions: null, engagementRate: null, keyEvents: null };
}

function organicForPath(rows: Map<string, PageTotals>, path: string): number | null { return rows.get(path)?.sessions ?? null; }

function findQueryRows(data: GscAnalyticsData | null, current: boolean, path: string): GscDimensionRow[] {
  const report = current ? data?.queryPages.current.data : data?.queryPages.previous.data;
  return (report?.rows ?? []).filter((row) => normalizePath(row.keys[1], true) === path);
}

function fixedSourceDefaults(now: Date, period: AnalyticsPeriod): SnapshotSources {
  const nowFactory = () => new Date(now.getTime());
  return {
    collectGa4: ({ period: selected }) => collectGa4({ period: selected, now: nowFactory }),
    collectGsc: ({ period: selected }) => collectGsc({ period: selected, now: nowFactory }),
    collectSiteHealth: () => collectSiteHealth({ now: nowFactory }),
    getContentHealth: () => createWordPressContentService({ now: nowFactory }).getContentHealth(),
  };
}

export async function collectAnalyticsSnapshot(options: CollectAnalyticsSnapshotOptions): Promise<AnalyticsSnapshot> {
  const now = options.now ?? new Date();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date");
  const collectedAt = now.toISOString();
  const period = buildAnalyticsPeriod(options.days, now);
  const defaults = fixedSourceDefaults(now, period);
  const sources = options.sources ?? defaults;
  const [ga4, gsc, web, content] = await Promise.all([
    isolate(() => sources.collectGa4({ period, now: () => new Date(now.getTime()) }), collectedAt),
    isolate(() => sources.collectGsc({ period, now: () => new Date(now.getTime()) }), collectedAt),
    isolate(() => sources.collectSiteHealth({ now: () => new Date(now.getTime()) }), collectedAt),
    isolate(() => sources.getContentHealth(), collectedAt),
  ]);
  const snapshotWarnings: SnapshotWarning[] = [...ga4.warnings, ...gsc.warnings, ...web.warnings, ...content.warnings].map(safeWarning);
  const ga4Data = value(ga4); const gscData = value(gsc); const webData = value(web); const contentData = value(content);
  const [overviewCurrent, overviewPrevious] = ga4Data ? pairData(ga4Data.overview) : [null, null];
  const [organicCurrent, organicPrevious] = ga4Data ? pairData(ga4Data.organicSearch) : [null, null];
  const [gscCurrent, gscPrevious] = gscData ? pairData(gscData.siteAggregate) : [null, null];
  const overviewCurrentOut = { sessions: overviewCurrent?.sessions ?? null, activeUsers: overviewCurrent?.activeUsers ?? null, engagedSessions: overviewCurrent?.engagedSessions ?? null, engagementRate: overviewCurrent?.engagementRate ?? null, keyEvents: overviewCurrent?.keyEvents ?? null, organicSessions: organicCurrent?.sessions ?? null, gsc: gscMetric(gscCurrent) };
  const overviewPreviousOut = { sessions: overviewPrevious?.sessions ?? null, activeUsers: overviewPrevious?.activeUsers ?? null, engagedSessions: overviewPrevious?.engagedSessions ?? null, engagementRate: overviewPrevious?.engagementRate ?? null, keyEvents: overviewPrevious?.keyEvents ?? null, organicSessions: organicPrevious?.sessions ?? null, gsc: gscMetric(gscPrevious) };
  const currentLanding = mergeGa4(ga4Data?.landingPages.current.data ?? null, snapshotWarnings);
  const previousLanding = mergeGa4(ga4Data?.landingPages.previous.data ?? null, snapshotWarnings);
  const currentOrganicLanding = mergeGa4(ga4Data?.organicLandingPages.current.data ?? null, snapshotWarnings);
  const previousOrganicLanding = mergeGa4(ga4Data?.organicLandingPages.previous.data ?? null, snapshotWarnings);
  const currentGscPages = gscPages(gscData?.pages.current.data ?? null, snapshotWarnings);
  const previousGscPages = gscPages(gscData?.pages.previous.data ?? null, snapshotWarnings);
  const paths = new Set([...currentLanding.keys(), ...previousLanding.keys(), ...currentOrganicLanding.keys(), ...previousOrganicLanding.keys(), ...currentGscPages.keys(), ...previousGscPages.keys()]);
  const pages = [...paths].map((path) => ({ path, current: { ...metricForPath(currentLanding, path), organicSessions: organicForPath(currentOrganicLanding, path), gsc: gscMetric(currentGscPages.get(path) ?? null) }, previous: { ...metricForPath(previousLanding, path), organicSessions: organicForPath(previousOrganicLanding, path), gsc: gscMetric(previousGscPages.get(path) ?? null) } }))
    .sort((left, right) => (right.current.sessions ?? -1) - (left.current.sessions ?? -1) || left.path.localeCompare(right.path));
  const healthByPath = new Map((webData?.targets ?? []).map((target) => [target.path, target]));
  const focusAreas: FocusArea[] = FOCUS_AREAS.map(([name, path]) => {
    const candidates = findQueryRows(gscData, true, path);
    const chosen = candidates[0] ?? null;
    const previous = chosen ? findQueryRows(gscData, false, path).find((row) => row.keys[0] === chosen.keys[0]) ?? null : null;
    const currentOrganic = organicForPath(currentOrganicLanding, path); const previousOrganic = organicForPath(previousOrganicLanding, path);
    const current = { ...gscMetric(chosen), organicSessions: currentOrganic };
    const prior = { ...gscMetric(previous), organicSessions: previousOrganic };
    const health = healthByPath.get(path) ?? null;
    return { name, path, mainQuery: chosen?.keys[0] ?? null, current, previous: prior, deltas: { clicks: delta(current.clicks, prior.clicks), impressions: delta(current.impressions, prior.impressions), ctr: delta(current.ctr, prior.ctr), position: delta(current.position, prior.position), organicSessions: delta(current.organicSessions, prior.organicSessions) }, siteHealth: health, checkedAt: health?.checkedAt ?? null, collectedAt: gsc?.collectedAt ?? null };
  });
  const topPositions = focusAreas.map((row) => row.current.position);
  const completeTop = gscData?.queryPages.current.state === "ok" && topPositions.every((position) => position !== null);
  const topCounts = (limit: number) => completeTop ? topPositions.filter((position) => position! <= limit).length : null;
  const warningMap = new Map<string, SnapshotWarning>();
  for (const warning of snapshotWarnings) warningMap.set(warning.code, warning);
  return {
    schemaVersion: "1.0.0", timezone: "Asia/Tokyo", generatedAt: collectedAt, collectedAt, period,
    sources: { ga4: summary(ga4, period), gsc: summary(gsc, gscData?.period ?? period), web: summary(web), content: summary(content) },
    overview: { current: overviewCurrentOut, previous: overviewPreviousOut, deltas: { sessions: delta(overviewCurrentOut.sessions, overviewPreviousOut.sessions), activeUsers: delta(overviewCurrentOut.activeUsers, overviewPreviousOut.activeUsers), engagedSessions: delta(overviewCurrentOut.engagedSessions, overviewPreviousOut.engagedSessions), engagementRate: delta(overviewCurrentOut.engagementRate, overviewPreviousOut.engagementRate), keyEvents: delta(overviewCurrentOut.keyEvents, overviewPreviousOut.keyEvents), organicSessions: delta(overviewCurrentOut.organicSessions, overviewPreviousOut.organicSessions), clicks: delta(overviewCurrentOut.gsc.clicks, overviewPreviousOut.gsc.clicks), impressions: delta(overviewCurrentOut.gsc.impressions, overviewPreviousOut.gsc.impressions), ctr: delta(overviewCurrentOut.gsc.ctr, overviewPreviousOut.gsc.ctr), position: delta(overviewCurrentOut.gsc.position, overviewPreviousOut.gsc.position) } },
    seo: { focusAreas, topCounts: { top10: topCounts(10), top20: topCounts(20), top30: topCounts(30) } },
    pages, siteHealth: webData?.targets ?? null, contentHealth: contentData, warnings: [...warningMap.values()].sort((left, right) => left.code.localeCompare(right.code)),
  };
}
