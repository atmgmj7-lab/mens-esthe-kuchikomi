import "server-only";

import { getGoogleAccessToken } from "./google-credentials";
import type { AnalyticsDateRange, AnalyticsPeriod } from "./period";
import {
  analyticsFailure,
  analyticsSuccess,
  type AnalyticsSourceResult,
  type AnalyticsWarning,
} from "./result";

const GA4_ENDPOINT = "https://analyticsdata.googleapis.com/v1beta/properties";
const BREAKDOWN_LIMIT = 50;
const NON_NEGATIVE_METRICS = new Set(["sessions", "activeUsers", "engagedSessions", "keyEvents"]);

export type Ga4Overview = {
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  engagementRate: number;
  keyEvents: number;
};

export type Ga4OrganicSearch = { sessions: number };
export type Ga4LandingPage = {
  landingPage: string;
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  engagementRate: number;
  keyEvents: number;
};
export type Ga4Device = Ga4Overview & { deviceCategory: string };
export type Ga4ReportPair<T> = {
  current: AnalyticsSourceResult<T>;
  previous: AnalyticsSourceResult<T>;
};

export type Ga4AnalyticsData = {
  overview: Ga4ReportPair<Ga4Overview>;
  organicSearch: Ga4ReportPair<Ga4OrganicSearch>;
  landingPages: Ga4ReportPair<Ga4LandingPage[]>;
  organicLandingPages: Ga4ReportPair<Ga4LandingPage[]>;
  devices: Ga4ReportPair<Ga4Device[]>;
};

export type CollectGa4Options = {
  period: AnalyticsPeriod;
  propertyId?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

type ReportDefinition<T> = {
  name: string;
  metricNames: readonly string[];
  dimensionNames: readonly string[];
  limit?: number;
  orderBys?: readonly Record<string, unknown>[];
  dimensionFilter?: Record<string, unknown>;
  parse: (rows: ParsedRow[]) => T;
  singleRow?: boolean;
};

type ParsedRow = { dimensions: string[]; metrics: number[] };

function warnings(code: string, state: string): AnalyticsWarning[] {
  return [{ code, message: `state=${state}; code=${code}` }];
}

function reportFailure<T>(
  state: "auth_error" | "api_error" | "invalid_response" | "timeout",
  reportName: string,
  suffix: string
): AnalyticsSourceResult<T> {
  const code = `ga4_${reportName}_${suffix}`;
  return analyticsFailure(state, { warnings: warnings(code, state) });
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError");
}

function exactHeaderNames(value: unknown, expected: readonly string[], property: "metricHeaders" | "dimensionHeaders"): boolean {
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  const names = value.map((header) => (
    typeof header === "object" && header !== null && !Array.isArray(header)
      ? (header as Record<string, unknown>).name
      : undefined
  ));
  return names.every((name, index) => name === expected[index]) && new Set(names).size === names.length;
}

function parseMetricNumber(metricName: string, value: unknown): number | null {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (NON_NEGATIVE_METRICS.has(metricName) && number < 0) return null;
  if (metricName === "engagementRate" && (number < 0 || number > 1)) return null;
  return number;
}

function parseResponse<T>(definition: ReportDefinition<T>, body: unknown): AnalyticsSourceResult<T> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return reportFailure("invalid_response", definition.name, "invalid_shape");
  }
  const response = body as Record<string, unknown>;
  if (
    !exactHeaderNames(response.metricHeaders, definition.metricNames, "metricHeaders") ||
    !exactHeaderNames(response.dimensionHeaders ?? [], definition.dimensionNames, "dimensionHeaders")
  ) return reportFailure("invalid_response", definition.name, "invalid_headers");

  let rowCount: number | undefined;
  if (response.rowCount !== undefined) {
    if (typeof response.rowCount !== "number" || !Number.isSafeInteger(response.rowCount) || response.rowCount < 0) {
      return reportFailure("invalid_response", definition.name, "invalid_row_count");
    }
    rowCount = response.rowCount;
  }
  if (response.rows === undefined) {
    if (rowCount === undefined || rowCount === 0) {
      return analyticsFailure("no_data", { warnings: warnings(`ga4_${definition.name}_no_rows`, "no_data") });
    }
    return reportFailure("invalid_response", definition.name, "missing_rows");
  }
  if (!Array.isArray(response.rows)) return reportFailure("invalid_response", definition.name, "invalid_rows");
  if (rowCount !== undefined && response.rows.length > rowCount) {
    return reportFailure("invalid_response", definition.name, "inconsistent_row_count");
  }
  if (response.rows.length === 0) {
    if (rowCount !== undefined && rowCount > 0) return reportFailure("invalid_response", definition.name, "inconsistent_row_count");
    return analyticsFailure("no_data", { warnings: warnings(`ga4_${definition.name}_no_rows`, "no_data") });
  }
  if (definition.singleRow && response.rows.length !== 1) {
    return reportFailure("invalid_response", definition.name, "unexpected_row_count");
  }

  const rows: ParsedRow[] = [];
  for (const rowValue of response.rows) {
    if (typeof rowValue !== "object" || rowValue === null || Array.isArray(rowValue)) {
      return reportFailure("invalid_response", definition.name, "invalid_row_shape");
    }
    const row = rowValue as Record<string, unknown>;
    const dimensionValues = row.dimensionValues ?? [];
    const metricValues = row.metricValues;
    if (!Array.isArray(dimensionValues) || !Array.isArray(metricValues) ||
      dimensionValues.length !== definition.dimensionNames.length ||
      metricValues.length !== definition.metricNames.length) {
      return reportFailure("invalid_response", definition.name, "invalid_value_count");
    }
    const dimensions: string[] = [];
    for (const dimensionValue of dimensionValues) {
      if (typeof dimensionValue !== "object" || dimensionValue === null || Array.isArray(dimensionValue) ||
        typeof (dimensionValue as Record<string, unknown>).value !== "string") {
        return reportFailure("invalid_response", definition.name, "invalid_dimension_value");
      }
      dimensions.push((dimensionValue as Record<string, string>).value);
    }
    const metrics: number[] = [];
    for (const [index, metricValue] of metricValues.entries()) {
      const metric = typeof metricValue === "object" && metricValue !== null && !Array.isArray(metricValue)
        ? parseMetricNumber(definition.metricNames[index], (metricValue as Record<string, unknown>).value)
        : null;
      if (metric === null) return reportFailure("invalid_response", definition.name, "invalid_numeric_value");
      metrics.push(metric);
    }
    rows.push({ dimensions, metrics });
  }

  if (definition.dimensionNames.length > 0 && new Set(rows.map((row) => row.dimensions.join("\u0000"))).size !== rows.length) {
    return reportFailure("invalid_response", definition.name, "duplicate_dimension_row");
  }
  try {
    return analyticsSuccess(definition.parse(rows));
  } catch {
    return reportFailure("invalid_response", definition.name, "parse_failed");
  }
}

async function fetchReport<T>(
  definition: ReportDefinition<T>,
  range: AnalyticsDateRange,
  propertyId: string,
  accessToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<AnalyticsSourceResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${GA4_ENDPOINT}/${encodeURIComponent(propertyId)}:runReport`, {
      method: "POST",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        metrics: definition.metricNames.map((name) => ({ name })),
        ...(definition.dimensionNames.length > 0 ? { dimensions: definition.dimensionNames.map((name) => ({ name })) } : {}),
        ...(definition.dimensionFilter ? { dimensionFilter: definition.dimensionFilter } : {}),
        ...(definition.limit ? { limit: String(definition.limit) } : {}),
        ...(definition.orderBys ? { orderBys: definition.orderBys } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const state = response.status === 401 || response.status === 403 ? "auth_error" : "api_error";
      return reportFailure(state, definition.name, `http_${response.status}`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return reportFailure("timeout", definition.name, "timeout");
      if (error instanceof SyntaxError) return reportFailure("invalid_response", definition.name, "invalid_json");
      return reportFailure("api_error", definition.name, "body_read_failed");
    }
    return parseResponse(definition, body);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      return reportFailure("timeout", definition.name, "timeout");
    }
    return reportFailure("api_error", definition.name, "request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

const overview: ReportDefinition<Ga4Overview> = {
  name: "overview",
  metricNames: ["sessions", "activeUsers", "engagedSessions", "engagementRate", "keyEvents"],
  dimensionNames: [],
  singleRow: true,
  parse: ([row]) => ({
    sessions: row.metrics[0], activeUsers: row.metrics[1], engagedSessions: row.metrics[2],
    engagementRate: row.metrics[3], keyEvents: row.metrics[4],
  }),
};

const organicSearch: ReportDefinition<Ga4OrganicSearch> = {
  name: "organic_search",
  metricNames: ["sessions"],
  dimensionNames: ["sessionDefaultChannelGroup"],
  singleRow: true,
  dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
  parse: ([row]) => ({ sessions: row.metrics[0] }),
};

const landingPages: ReportDefinition<Ga4LandingPage[]> = {
  name: "landing_pages",
  metricNames: ["sessions", "activeUsers", "engagedSessions", "engagementRate", "keyEvents"],
  dimensionNames: ["landingPagePlusQueryString"],
  limit: BREAKDOWN_LIMIT,
  orderBys: [
    { metric: { metricName: "sessions" }, desc: true },
    { dimension: { dimensionName: "landingPagePlusQueryString" }, desc: false },
  ],
  parse: (rows) => rows.map((row) => ({
    landingPage: row.dimensions[0], sessions: row.metrics[0], activeUsers: row.metrics[1],
    engagedSessions: row.metrics[2], engagementRate: row.metrics[3], keyEvents: row.metrics[4],
  })),
};

const organicLandingPages: ReportDefinition<Ga4LandingPage[]> = {
  ...landingPages,
  name: "organic_landing_pages",
  dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
};

const devices: ReportDefinition<Ga4Device[]> = {
  name: "devices",
  metricNames: ["sessions", "activeUsers", "engagedSessions", "engagementRate", "keyEvents"],
  dimensionNames: ["deviceCategory"],
  limit: BREAKDOWN_LIMIT,
  orderBys: [
    { metric: { metricName: "sessions" }, desc: true },
    { dimension: { dimensionName: "deviceCategory" }, desc: false },
  ],
  parse: (rows) => rows.map((row) => ({
    deviceCategory: row.dimensions[0], sessions: row.metrics[0], activeUsers: row.metrics[1],
    engagedSessions: row.metrics[2], engagementRate: row.metrics[3], keyEvents: row.metrics[4],
  })),
};

function reportWarnings(data: Ga4AnalyticsData): AnalyticsWarning[] {
  return Object.values(data).flatMap((pair) => [pair.current, pair.previous])
    .filter((result) => result.state !== "ok")
    .flatMap((result) => result.warnings);
}

function aggregateAllFailureState(results: AnalyticsSourceResult<unknown>[]): "auth_error" | "api_error" | "invalid_response" | "timeout" {
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

export async function collectGa4(options: CollectGa4Options): Promise<AnalyticsSourceResult<Ga4AnalyticsData>> {
  const propertyId = options.propertyId ?? process.env.GA4_PROPERTY_ID;
  if (typeof propertyId !== "string" || propertyId.trim() === "") {
    return analyticsFailure("not_configured", { warnings: warnings("ga4_property_not_configured", "not_configured") });
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return analyticsFailure("invalid_response", { warnings: warnings("ga4_invalid_timeout", "invalid_response") });
  }
  const accessToken = await getGoogleAccessToken({
    fetchImpl: options.fetchImpl,
    now: options.now,
    timeoutMs,
  });
  if (accessToken.data === null) {
    return analyticsFailure(accessToken.state, {
      collectedAt: accessToken.collectedAt,
      warnings: accessToken.warnings,
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const [overviewCurrent, overviewPrevious, organicCurrent, organicPrevious, landingCurrent, landingPrevious, organicLandingCurrent, organicLandingPrevious, deviceCurrent, devicePrevious] = await Promise.all([
    fetchReport(overview, options.period.effective.current, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(overview, options.period.effective.previous, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(organicSearch, options.period.effective.current, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(organicSearch, options.period.effective.previous, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(landingPages, options.period.effective.current, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(landingPages, options.period.effective.previous, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(organicLandingPages, options.period.effective.current, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(organicLandingPages, options.period.effective.previous, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(devices, options.period.effective.current, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
    fetchReport(devices, options.period.effective.previous, propertyId, accessToken.data.accessToken, fetchImpl, timeoutMs),
  ]);
  const data: Ga4AnalyticsData = {
    overview: { current: overviewCurrent, previous: overviewPrevious },
    organicSearch: { current: organicCurrent, previous: organicPrevious },
    landingPages: { current: landingCurrent, previous: landingPrevious },
    organicLandingPages: { current: organicLandingCurrent, previous: organicLandingPrevious },
    devices: { current: deviceCurrent, previous: devicePrevious },
  };
  const allResults = Object.values(data).flatMap((pair) => [pair.current, pair.previous]);
  const failures = allResults.filter((result) => result.state !== "ok" && result.state !== "no_data");
  const noData = allResults.filter((result) => result.state === "no_data");
  const successes = allResults.filter((result) => result.state === "ok");
  if (successes.length > 0 && (failures.length > 0 || noData.length > 0) || failures.length > 0 && noData.length > 0) {
    return analyticsSuccess(data, { state: "partial", warnings: reportWarnings(data) });
  }
  if (failures.length > 0) {
    return analyticsFailure(aggregateAllFailureState(failures), { warnings: reportWarnings(data) });
  }
  if (successes.length === 0) {
    return analyticsFailure("no_data", { warnings: warnings("ga4_no_rows", "no_data") });
  }
  return analyticsSuccess(data);
}
