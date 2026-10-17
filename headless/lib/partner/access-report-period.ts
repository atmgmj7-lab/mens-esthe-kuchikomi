export const partnerAccessReportDays = [7, 28, 90] as const;

export type PartnerAccessReportDays = typeof partnerAccessReportDays[number];

export type PartnerAccessReportPeriod = {
  days: PartnerAccessReportDays;
  timezone: "Asia/Tokyo";
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  provisionalOn: string;
};

const TOKYO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function asTokyoCalendarDate(value: Date): Date {
  const parts = TOKYO_DATE_FORMAT.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value;
  return new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))));
}

function addCalendarDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isPartnerAccessReportDays(value: number): value is PartnerAccessReportDays {
  return (partnerAccessReportDays as readonly number[]).includes(value);
}

export function buildPartnerAccessReportPeriod(days: PartnerAccessReportDays, now = new Date()): PartnerAccessReportPeriod {
  if (!isPartnerAccessReportDays(days)) throw new RangeError("Partner access report days must be 7, 28, or 90");
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a valid Date");

  const today = asTokyoCalendarDate(now);
  // Daily comparison becomes final only after the day closes.  Keep today's
  // recorded values separate so an incomplete day cannot poison every range.
  const to = addCalendarDays(today, -1);
  const from = addCalendarDays(to, -(days - 1));
  const previousTo = addCalendarDays(from, -1);
  const previousFrom = addCalendarDays(previousTo, -(days - 1));
  return {
    days,
    timezone: "Asia/Tokyo",
    from: formatCalendarDate(from),
    to: formatCalendarDate(to),
    previousFrom: formatCalendarDate(previousFrom),
    previousTo: formatCalendarDate(previousTo),
    provisionalOn: formatCalendarDate(today),
  };
}
