"use client";

import Link from "next/link";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            ← ダッシュボード
          </Link>
          <h1 className="text-lg font-bold text-white">詳細分析</h1>
        </div>
        <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
          GA4 コンソール ↗
        </a>
        <a href="https://search.google.com/search-console/" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
          Search Console ↗
        </a>
      </header>
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <AnalyticsDashboard showWeekly showQuickLinks={false} />
      </main>
      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-600 text-center">
        mens-esthe-kuchikomi 管理ダッシュボード
      </footer>
    </div>
  );
}
