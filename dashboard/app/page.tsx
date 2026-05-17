"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MetricCard from "@/components/MetricCard";
import LineChart from "@/components/LineChart";
import PageRanking from "@/components/PageRanking";
import WPQuickLinks from "@/components/WPQuickLinks";
import {
  fetchGA4Daily,
  fetchGA4Totals,
  fetchGA4Pages,
  formatDuration,
  formatNumber,
  type DailyMetric,
  type Totals,
  type PageMetric,
} from "@/lib/ga";

export default function DashboardPage() {
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [pages, setPages] = useState<PageMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetchGA4Daily(),
      fetchGA4Totals(),
      fetchGA4Pages(),
    ]).then(([d, t, p]) => {
      if (d.status === "fulfilled") setDaily(d.value);
      if (t.status === "fulfilled") setTotals(t.value);
      if (p.status === "fulfilled") setPages(p.value);
      setLoading(false);
    });
  }, []);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">
            mens-esthe-kuchikomi
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {totals?._mock && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
              モックデータ
            </span>
          )}
          <Link
            href="/analytics"
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            詳細分析 →
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            直近30日の概要
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="ページビュー"
              value={totals ? formatNumber(totals.pageviews) : undefined}
              hint="直近30日"
              loading={loading}
            />
            <MetricCard
              label="セッション"
              value={totals ? formatNumber(totals.sessions) : undefined}
              hint="直近30日"
              loading={loading}
            />
            <MetricCard
              label="直帰率"
              value={totals ? `${totals.bounceRate}` : undefined}
              suffix="%"
              loading={loading}
            />
            <MetricCard
              label="平均滞在時間"
              value={totals ? formatDuration(totals.avgDuration) : undefined}
              loading={loading}
            />
          </div>
        </section>

        <section>
          <LineChart data={daily} loading={loading} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PageRanking items={pages} loading={loading} />
          <WPQuickLinks />
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-600 text-center">
        mens-esthe-kuchikomi 管理ダッシュボード
      </footer>
    </div>
  );
}
