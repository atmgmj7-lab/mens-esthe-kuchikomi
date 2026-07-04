export type PeriodDays = 7 | 30 | 90 | "all";

export const PERIOD_OPTIONS: { value: PeriodDays; label: string }[] = [
  { value: 7, label: "7日" },
  { value: 30, label: "30日" },
  { value: 90, label: "90日" },
  { value: "all", label: "全期間" },
];

export function periodLabel(days: PeriodDays): string {
  if (days === "all") return "全期間";
  return `直近${days}日`;
}
