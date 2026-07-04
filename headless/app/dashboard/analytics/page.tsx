"use client";

import Link from "next/link";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header-group">
          <Link
            href="/dashboard"
            className="dashboard-secondary-link"
          >
            ダッシュボード
          </Link>
          <div>
            <p className="dashboard-eyebrow">Detailed Analytics</p>
            <h1 className="dashboard-title">詳細分析</h1>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="dashboard-secondary-link">
            GA4
          </a>
          <a href="https://search.google.com/search-console/" target="_blank" rel="noopener noreferrer" className="dashboard-secondary-link">
            Search Console
          </a>
        </div>
      </header>
      <main className="dashboard-main">
        <AnalyticsDashboard showWeekly showQuickLinks={false} />
      </main>
      <footer className="dashboard-footer">
        mens-esthe-kuchikomi 管理ダッシュボード
      </footer>
    </div>
  );
}
