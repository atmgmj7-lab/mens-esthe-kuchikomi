import type { PeriodDays } from "./period";

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

type Ga4LiveEnvelope = {
  status: "live";
  source: "ga4";
  data: unknown;
};

const PROXY_URL =
  "/wp-content/themes/swell_child/dashboard/api/ga-proxy.php";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMetricList<T>(
  value: unknown,
  validate: (item: Record<string, unknown>) => boolean
): value is T[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && validate(item));
}

export function parseGa4LiveEnvelope(value: unknown): Ga4LiveEnvelope | null {
  if (!isRecord(value)) return null;
  if (value.status !== "live" || value.source !== "ga4") return null;
  if (!("data" in value)) return null;
  return { status: "live", source: "ga4", data: value.data };
}

function isDailyMetricList(value: unknown): value is DailyMetric[] {
  return isMetricList<DailyMetric>(
    value,
    (item) =>
      typeof item.date === "string" && /^\d{8}$/.test(item.date) &&
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
    isFiniteNumber(value.avgDuration)
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

async function fetchProxy<T>(
  action: string,
  days: PeriodDays,
  validate: (value: unknown) => value is T
): Promise<T> {
  const response = await fetch(
    `${PROXY_URL}?action=${action}&days=${encodeURIComponent(String(days))}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`GA4 request failed: ${response.status}`);
  }

  const envelope = parseGa4LiveEnvelope(await response.json());
  if (!envelope || !validate(envelope.data)) {
    throw new Error("GA4 response is invalid");
  }
  return envelope.data;
}

export async function fetchGA4Daily(days: PeriodDays): Promise<DailyMetric[]> {
  return fetchProxy("daily", days, isDailyMetricList);
}

export async function fetchGA4Totals(days: PeriodDays): Promise<Totals> {
  return fetchProxy("totals", days, isTotals);
}

export async function fetchGA4Pages(days: PeriodDays): Promise<PageMetric[]> {
  return fetchProxy("pages", days, isPageMetricList);
}

export async function fetchGA4Creatives(days: PeriodDays): Promise<CreativeMetric[]> {
  return fetchProxy("creatives", days, isCreativeMetricList);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
