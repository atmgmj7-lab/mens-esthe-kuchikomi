export type AnalyticsDays = 7 | 28;

export type AnalyticsDateRange = {
  startDate: string;
  endDate: string;
};

export type AnalyticsPeriod = {
  days: AnalyticsDays;
  timezone: "Asia/Tokyo";
  requested: {
    current: AnalyticsDateRange;
    previous: AnalyticsDateRange;
  };
  effective: {
    current: AnalyticsDateRange;
    previous: AnalyticsDateRange;
  };
};

const TOKYO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function asTokyoCalendarDate(value: Date): Date {
  const parts = TOKYO_DATE_FORMAT.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  return new Date(Date.UTC(year, month - 1, day));
}

function addTokyoDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function range(start: Date, end: Date): AnalyticsDateRange {
  return { startDate: formatCalendarDate(start), endDate: formatCalendarDate(end) };
}

function copyRange(value: AnalyticsDateRange): AnalyticsDateRange {
  return { startDate: value.startDate, endDate: value.endDate };
}

export function buildAnalyticsPeriod(days: AnalyticsDays, now = new Date()): AnalyticsPeriod {
  if (days !== 7 && days !== 28) throw new RangeError("Analytics days must be 7 or 28");
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date");

  const latestCompletedDay = addTokyoDays(asTokyoCalendarDate(now), -1);
  const currentStart = addTokyoDays(latestCompletedDay, -(days - 1));
  const previousEnd = addTokyoDays(currentStart, -1);
  const previousStart = addTokyoDays(previousEnd, -(days - 1));
  const requested = {
    current: range(currentStart, latestCompletedDay),
    previous: range(previousStart, previousEnd),
  };

  return {
    days,
    timezone: "Asia/Tokyo",
    requested,
    effective: {
      current: copyRange(requested.current),
      previous: copyRange(requested.previous),
    },
  };
}
