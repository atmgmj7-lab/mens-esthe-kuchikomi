import { collectAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import AnalyticsDashboardView from "./AnalyticsDashboardView";
import styles from "./AnalyticsDashboardView.module.css";
import { parseAnalyticsDashboardParams, type DashboardParams } from "./dashboard-ui";

export default async function AnalyticsPage({ searchParams }: Readonly<{ searchParams: Promise<DashboardParams> }>) {
  const parsed = parseAnalyticsDashboardParams(await searchParams);
  if (!parsed.ok) return <section aria-labelledby="analytics-invalid"><h2 id="analytics-invalid">Analytics表示条件エラー</h2><p>{parsed.message}</p></section>;
  const snapshot = await collectAnalyticsSnapshot({ days: parsed.days });
  return <AnalyticsDashboardView snapshot={snapshot} view={parsed.view} styles={styles} />;
}
