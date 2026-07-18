type Ga4LiveEnvelope = {
  status: "live";
  source: "ga4";
  data: unknown;
};

type DailyMetricLike = {
  date: string;
  pageviews: number;
  sessions: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGa4LiveEnvelope(value: unknown): Ga4LiveEnvelope | null {
  if (!isRecord(value)) return null;
  if (value.status !== "live" || value.source !== "ga4") return null;
  if (!("data" in value)) return null;
  return { status: "live", source: "ga4", data: value.data };
}

export function normalizeGa4Date(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matched = compact ?? iso;
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${matched[1]}${matched[2]}${matched[3]}`;
}

export function isGa4DailyMetricList(value: unknown): value is DailyMetricLike[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        normalizeGa4Date(item.date) !== null &&
        typeof item.pageviews === "number" &&
        Number.isFinite(item.pageviews) &&
        typeof item.sessions === "number" &&
        Number.isFinite(item.sessions)
    )
  );
}

export function normalizeGa4DailyMetrics<T extends DailyMetricLike>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    date: normalizeGa4Date(item.date) ?? item.date,
  }));
}
