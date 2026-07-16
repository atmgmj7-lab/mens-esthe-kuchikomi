import type { Metadata } from "next";
import Link from "next/link";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "WP ダッシュボード",
  description: "mens-esthe-kuchikomi.com 管理ダッシュボード",
  path: "/dashboard/",
  robots: {
    index: false,
    follow: false
  }
});

export default function DashboardPage() {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Eskomi Growth Command</p>
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
