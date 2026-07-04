import Link from "next/link";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function DashboardPage() {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Escomi Growth Command</p>
          <h1 className="dashboard-title">エスコミ管理ダッシュボード</h1>
        </div>
        <Link
          href="/dashboard/analytics"
          className="dashboard-header-link"
        >
          詳細分析
        </Link>
      </header>
      <main className="dashboard-main">
        <AnalyticsDashboard />
      </main>
      <footer className="dashboard-footer">
        mens-esthe-kuchikomi 管理ダッシュボード
      </footer>
    </div>
  );
}
