"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LineChart from "@/components/LineChart";
import MetricCard from "@/components/MetricCard";
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

export default function AnalyticsPage() {
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

  const weeklyData =
    daily.length > 0
      ? Array.from({ length: Math.ceil(daily.length / 7) }, (_, wi) => {
          const slice = daily.slice(wi * 7, wi * 7 + 7);
          return {
            date: slice[0]?.date ?? "",
            pageviews: slice.reduce((s, d) => s + d.pageviews, 0),
            sessions: slice.reduce((s, d) => s + d.sessions, 0),
          };
        })
      : [];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            ← ダッシュボード
          </Link>
          <h1 className="text-lg font-bold text-white">詳細分析</h1>
        </div>
        <div className="flex items-center gap-3">
          {totals?._mock && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
              モックデータ
            </span>
          )}
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            GA4 コンソール ↗
          </a>
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
              loading={loading}
            />
            <MetricCard
              label="セッション"
              value={totals ? formatNumber(totals.sessions) : undefined}
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
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            日次トレンド
          </h2>
          <LineChart data={daily} loading={loading} />
        </section>

        {!loading && weeklyData.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              週次サマリー
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {weeklyData.map((w, i) => {
                const mm = w.date.slice(4, 6);
                const dd = w.date.slice(6, 8);
                return (
                  <div
                    key={i}
                    className="rounded-xl bg-zinc-900 border border-zinc-800 p-4"
                  >
                    <p className="text-xs text-zinc-500 mb-2">
                      第{i + 1}週（{parseInt(mm)}/{parseInt(dd)}〜）
                    </p>
                    <p className="text-xl font-bold text-white">
                      {formatNumber(w.pageviews)}
                    </p>
                    <p className="text-xs text-zinc-500">PV</p>
                    <p className="text-sm font-semibold text-emerald-400 mt-1">
                      {formatNumber(w.sessions)}
                    </p>
                    <p className="text-xs text-zinc-500">セッション</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
