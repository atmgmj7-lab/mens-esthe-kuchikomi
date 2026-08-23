import "server-only";

import {
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
  getGoogleAccessToken,
} from "./google-credentials";
import type { AnalyticsDateRange, AnalyticsPeriod } from "./period";
import {
  analyticsFailure,
  analyticsSuccess,
  type AnalyticsSourceResult,
  type AnalyticsWarning,
} from "./result";

const GSC_SITE_URL = "sc-domain:mens-esthe-kuchikomi.com";
const GSC_QUERY_ENDPOINT = "https://www.googleapis.com/webmasters/v3/sites";
const DEFAULT_PAGE_SIZE = 1_000;
const DEFAULT_MAX_PAGES = 25;
const MAX_GSC_PAGE_SIZE = 25_000;

export type GscMetric = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscDimensionRow = GscMetric & { keys: string[] };
export type GscRowCoverage = "NOT_RETURNED" | "COMPLETE";
export type GscDimensionData = {
  rows: GscDimensionRow[];
  rowCoverage: GscRowCoverage;
};

export type GscReportPair<T> = {
  current: AnalyticsSourceResult<T>;
  previous: AnalyticsSourceResult<T>;
};

export type GscAnalyticsData = {
  latestFinalDate: string;
  period: AnalyticsPeriod;
  siteAggregate: GscReportPair<GscMetric>;
  queries: GscReportPair<GscDimensionData>;
  pages: GscReportPair<GscDimensionData>;
  queryPages: GscReportPair<GscDimensionData>;
  devices: GscReportPair<GscDimensionData>;
  countries: GscReportPair<GscDimensionData>;
};

export type CollectGscOptions = {
  period: AnalyticsPeriod;
  siteUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  pageSize?: number;
  maxPages?: number;
};

type GscDimension = "query" | "page" | "device" | "country";
type GscResponse = { rows?: unknown[] };

function warnings(code: string, state: string): AnalyticsWarning[] {
  return [{ code, message: `state=${state}; code=${code}` }];
}

function failure<T>(
  state: "auth_error" | "api_error" | "invalid_response" | "timeout",
  name: string,
  suffix: string
): AnalyticsSourceResult<T> {
  const code = `gsc_${name}_${suffix}`;
  return analyticsFailure(state, { warnings: warnings(code, state) });
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError");
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateOffset(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function dateSpan(startDate: string, endDate: string): number {
  return (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000;
}

function validRange(range: AnalyticsDateRange, days: number): boolean {
  return isCalendarDate(range.startDate) && isCalendarDate(range.endDate) && dateSpan(range.startDate, range.endDate) === days - 1;
}

function validPeriod(period: AnalyticsPeriod): boolean {
  if (period.timezone !== "Asia/Tokyo" || (period.days !== 7 && period.days !== 28)) return false;
  const { current, previous } = period.requested;
  return validRange(current, period.days) && validRange(previous, period.days) &&
    dateOffset(current.startDate, -1) === previous.endDate;
}

function cloneAndClampPeriod(period: AnalyticsPeriod, latestFinalDate: string): AnalyticsPeriod {
  const shift = dateSpan(latestFinalDate, period.requested.current.endDate);
  const clamp = (range: AnalyticsDateRange): AnalyticsDateRange => ({
    startDate: dateOffset(range.startDate, -shift),
    endDate: dateOffset(range.endDate, -shift),
  });
  return {
    days: period.days,
    timezone: "Asia/Tokyo",
    requested: {
      current: { ...period.requested.current },
      previous: { ...period.requested.previous },
    },
    effective: {
      current: clamp(period.requested.current),
      previous: clamp(period.requested.previous),
    },
  };
}

function parseMetric(value: unknown): GscMetric | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const { clicks, impressions, ctr, position } = row;
  if (
    typeof clicks !== "number" || !Number.isFinite(clicks) ||
    typeof impressions !== "number" || !Number.isFinite(impressions) ||
    typeof ctr !== "number" || !Number.isFinite(ctr) ||
    typeof position !== "number" || !Number.isFinite(position)
  ) return null;
  if (clicks < 0 || impressions < 0 || ctr < 0 || ctr > 1 || position < 0) return null;
  return { clicks, impressions, ctr, position };
}

function parseAggregateMetric(value: unknown): GscMetric | null {
  if (typeof value !== "object" || value === null || Array.isArray(value) || "keys" in value) return null;
  return parseMetric(value);
}

function parseRows(value: unknown, keyCount: number): GscDimensionRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: GscDimensionRow[] = [];
  const seen = new Set<string>();
  for (const valueRow of value) {
    const metric = parseMetric(valueRow);
    const keys = metric !== null && typeof valueRow === "object" && valueRow !== null && !Array.isArray(valueRow)
      ? (valueRow as Record<string, unknown>).keys
      : null;
    if (!metric || !Array.isArray(keys) || keys.length !== keyCount || !keys.every((key) => typeof key === "string")) return null;
    const row = { ...metric, keys: [...keys] as string[] };
    const identity = JSON.stringify(row.keys);
    if (seen.has(identity)) return null;
    seen.add(identity);
    rows.push(row);
  }
  return rows;
}

function compareRows(left: GscDimensionRow, right: GscDimensionRow): number {
  if (left.clicks !== right.clicks) return left.clicks > right.clicks ? -1 : 1;
  const sharedLength = Math.min(left.keys.length, right.keys.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (left.keys[index] < right.keys[index]) return -1;
    if (left.keys[index] > right.keys[index]) return 1;
  }
  return left.keys.length - right.keys.length;
}

async function postSearchAnalytics(
  siteUrl: string,
  body: Record<string, unknown>,
  accessToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  name: string
): Promise<AnalyticsSourceResult<GscResponse>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${GSC_QUERY_ENDPOINT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      cache: "no-store",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return failure(response.status === 401 || response.status === 403 ? "auth_error" : "api_error", name, `http_${response.status}`);
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return failure("timeout", name, "timeout");
      if (error instanceof SyntaxError) return failure("invalid_response", name, "invalid_json");
      return failure("api_error", name, "body_read_failed");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return failure("invalid_response", name, "invalid_shape");
    const rows = (parsed as Record<string, unknown>).rows;
    if (rows !== undefined && !Array.isArray(rows)) return failure("invalid_response", name, "invalid_rows");
    return analyticsSuccess({ ...(rows === undefined ? {} : { rows }) });
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) return failure("timeout", name, "timeout");
    return failure("api_error", name, "request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverLatestFinalDate(
  period: AnalyticsPeriod,
  siteUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<AnalyticsSourceResult<string>> {
  const response = await postSearchAnalytics(siteUrl, {
    startDate: period.requested.previous.startDate,
    endDate: period.requested.current.endDate,
    dimensions: ["date"],
    type: "web",
    dataState: "final",
    aggregationType: "auto",
    rowLimit: MAX_GSC_PAGE_SIZE,
    startRow: 0,
  }, accessToken, fetchImpl, timeoutMs, "latest_final_date");
  if (response.data === null) return analyticsFailure(response.state, { collectedAt: response.collectedAt, warnings: response.warnings });
  if (response.data.rows === undefined || response.data.rows.length === 0) {
    return analyticsFailure("no_data", { warnings: warnings("gsc_latest_final_date_no_rows", "no_data") });
  }
  const rows = parseRows(response.data.rows, 1);
  if (!rows || !rows.every((row) => isCalendarDate(row.keys[0]))) return failure("invalid_response", "latest_final_date", "invalid_rows");
  const latest = rows.map((row) => row.keys[0]).sort().at(-1)!;
  if (latest > period.requested.current.endDate) return failure("invalid_response", "latest_final_date", "future_date");
  return analyticsSuccess(latest);
}

async function fetchAggregate(
  range: AnalyticsDateRange,
  siteUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<AnalyticsSourceResult<GscMetric>> {
  const response = await postSearchAnalytics(siteUrl, {
    startDate: range.startDate,
    endDate: range.endDate,
    type: "web",
    dataState: "final",
    aggregationType: "byProperty",
    rowLimit: 1,
  }, accessToken, fetchImpl, timeoutMs, "site_aggregate");
  if (response.data === null) return analyticsFailure(response.state, { collectedAt: response.collectedAt, warnings: response.warnings });
  if (response.data.rows === undefined || response.data.rows.length === 0) {
    return analyticsFailure("no_data", { warnings: warnings("gsc_site_aggregate_no_rows", "no_data") });
  }
  if (response.data.rows.length !== 1) return failure("invalid_response", "site_aggregate", "unexpected_row_count");
  const metric = parseAggregateMetric(response.data.rows[0]);
  return metric ? analyticsSuccess(metric) : failure("invalid_response", "site_aggregate", "invalid_metric");
}

async function fetchDimension(
  dimension: GscDimension | readonly ["query", "page"],
  range: AnalyticsDateRange,
  siteUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  pageSize: number,
  maxPages: number
): Promise<AnalyticsSourceResult<GscDimensionData>> {
  const dimensionNames = typeof dimension === "string" ? [dimension] : [...dimension];
  const name = dimensionNames.join("_");
  const allRows: GscDimensionRow[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < maxPages; page += 1) {
    const response = await postSearchAnalytics(siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: dimensionNames,
      type: "web",
      dataState: "final",
      aggregationType: "auto",
      rowLimit: pageSize,
      startRow: allRows.length,
    }, accessToken, fetchImpl, timeoutMs, name);
    if (response.data === null) return analyticsFailure(response.state, { collectedAt: response.collectedAt, warnings: response.warnings });
    if (response.data.rows === undefined || response.data.rows.length === 0) {
      return analyticsSuccess({ rows: allRows.sort(compareRows), rowCoverage: "NOT_RETURNED" });
    }
    const rows = parseRows(response.data.rows, dimensionNames.length);
    if (!rows) return failure("invalid_response", name, "invalid_rows");
    for (const row of rows) {
      const identity = JSON.stringify(row.keys);
      if (seen.has(identity)) return failure("invalid_response", name, "duplicate_dimension_row");
      seen.add(identity);
      allRows.push(row);
    }
    if (rows.length < pageSize) return analyticsSuccess({ rows: allRows.sort(compareRows), rowCoverage: "NOT_RETURNED" });
  }
  return analyticsSuccess(
    { rows: allRows.sort(compareRows), rowCoverage: "NOT_RETURNED" },
    { state: "partial", warnings: warnings(`gsc_${name}_pagination_cap`, "partial") }
  );
}

function reportWarnings(data: GscAnalyticsData): AnalyticsWarning[] {
  return [data.siteAggregate, data.queries, data.pages, data.queryPages, data.devices, data.countries]
    .flatMap((pair) => [pair.current, pair.previous])
    .filter((result) => result.state !== "ok")
    .flatMap((result) => result.warnings);
}

function aggregateFailureState(results: AnalyticsSourceResult<unknown>[]): "auth_error" | "api_error" | "invalid_response" | "timeout" {
  const states = results.map((result) => result.state);
  if (states.every((state) => state === "auth_error")) return "auth_error";
  if (states.every((state) => state === "api_error")) return "api_error";
  if (states.every((state) => state === "invalid_response")) return "invalid_response";
  if (states.every((state) => state === "timeout")) return "timeout";
  for (const state of ["timeout", "api_error", "invalid_response", "auth_error"] as const) {
    if (states.includes(state)) return state;
  }
  return "invalid_response";
}

export async function collectGsc(options: CollectGscOptions): Promise<AnalyticsSourceResult<GscAnalyticsData>> {
  const siteUrl = options.siteUrl ?? GSC_SITE_URL;
  if (siteUrl !== GSC_SITE_URL) return analyticsFailure("invalid_response", { warnings: warnings("gsc_invalid_site_url", "invalid_response") });
  if (!validPeriod(options.period)) return analyticsFailure("invalid_response", { warnings: warnings("gsc_invalid_period", "invalid_response") });
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_GSC_PAGE_SIZE ||
    !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1_000) {
    return analyticsFailure("invalid_response", { warnings: warnings("gsc_invalid_options", "invalid_response") });
  }
  const accessToken = await getGoogleAccessToken({
    fetchImpl: options.fetchImpl,
    now: options.now,
    timeoutMs,
    scope: GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
  });
  if (accessToken.data === null) return analyticsFailure(accessToken.state, { collectedAt: accessToken.collectedAt, warnings: accessToken.warnings });

  const fetchImpl = options.fetchImpl ?? fetch;
  const latest = await discoverLatestFinalDate(options.period, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs);
  if (latest.data === null) return analyticsFailure(latest.state, { collectedAt: latest.collectedAt, warnings: latest.warnings });
  const clampedPeriod = cloneAndClampPeriod(options.period, latest.data);
  const [aggregateCurrent, aggregatePrevious, queriesCurrent, queriesPrevious, pagesCurrent, pagesPrevious, queryPagesCurrent, queryPagesPrevious, devicesCurrent, devicesPrevious, countriesCurrent, countriesPrevious] = await Promise.all([
    fetchAggregate(clampedPeriod.effective.current, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchAggregate(clampedPeriod.effective.previous, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchDimension("query", clampedPeriod.effective.current, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("query", clampedPeriod.effective.previous, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("page", clampedPeriod.effective.current, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("page", clampedPeriod.effective.previous, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension(["query", "page"], clampedPeriod.effective.current, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension(["query", "page"], clampedPeriod.effective.previous, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("device", clampedPeriod.effective.current, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("device", clampedPeriod.effective.previous, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("country", clampedPeriod.effective.current, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
    fetchDimension("country", clampedPeriod.effective.previous, siteUrl, accessToken.data.accessToken, fetchImpl, timeoutMs, pageSize, maxPages),
  ]);
  const data: GscAnalyticsData = {
    latestFinalDate: latest.data,
    period: clampedPeriod,
    siteAggregate: { current: aggregateCurrent, previous: aggregatePrevious },
    queries: { current: queriesCurrent, previous: queriesPrevious },
    pages: { current: pagesCurrent, previous: pagesPrevious },
    queryPages: { current: queryPagesCurrent, previous: queryPagesPrevious },
    devices: { current: devicesCurrent, previous: devicesPrevious },
    countries: { current: countriesCurrent, previous: countriesPrevious },
  };
  const allResults = [data.siteAggregate, data.queries, data.pages, data.queryPages, data.devices, data.countries]
    .flatMap((pair) => [pair.current, pair.previous]);
  const failures = allResults.filter((result) => !["ok", "partial", "no_data"].includes(result.state));
  const nonOk = allResults.filter((result) => result.state !== "ok");
  const success = allResults.some((result) => result.state === "ok" || result.state === "partial");
  if (success && nonOk.length > 0 || failures.length > 0 && allResults.some((result) => result.state === "no_data")) {
    return analyticsSuccess(data, { state: "partial", warnings: reportWarnings(data) });
  }
  if (failures.length > 0) return analyticsFailure(aggregateFailureState(failures), { warnings: reportWarnings(data) });
  if (!success) return analyticsFailure("no_data", { warnings: warnings("gsc_no_rows", "no_data") });
  return analyticsSuccess(data);
}
