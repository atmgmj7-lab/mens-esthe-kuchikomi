"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/MetricCard";
import LineChart from "@/components/LineChart";
import PageRanking from "@/components/PageRanking";
import CreativeTable from "@/components/CreativeTable";
import PeriodSelector from "@/components/PeriodSelector";
import WPQuickLinks from "@/components/WPQuickLinks";
import {
  fetchGA4Daily,
  fetchGA4Totals,
  fetchGA4Pages,
  fetchGA4Creatives,
  formatDuration,
  formatNumber,
  type DailyMetric,
  type Totals,
  type PageMetric,
  type CreativeMetric,
} from "@/lib/ga";
import type { PeriodDays } from "@/lib/period";
import { periodLabel } from "@/lib/period";

type Props = {
  showWeekly?: boolean;
  showQuickLinks?: boolean;
};

export default function AnalyticsDashboard({
  showWeekly = false,
  showQuickLinks = true,
}: Props) {
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [pages, setPages] = useState<PageMetric[]>([]);
  const [creatives, setCreatives] = useState<CreativeMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchGA4Daily(period),
      fetchGA4Totals(period),
      fetchGA4Pages(period),
      fetchGA4Creatives(period),
    ]).then(([d, t, p, c]) => {
      if (d.status === "fulfilled") setDaily(d.value);
      if (t.status === "fulfilled") setTotals(t.value);
      if (p.status === "fulfilled") setPages(p.value);
      if (c.status === "fulfilled") setCreatives(c.value);
      setLoading(false);
    });
  }, [period]);

  const label = periodLabel(period);
  const weeklyData =
    showWeekly && daily.length > 0
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        {totals?._mock && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
            モックデータ（GA4未設定）
          </span>
        )}
      </div>

      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          {label}の概要
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="ページビュー" value={totals ? formatNumber(totals.pageviews) : undefined} hint={label} loading={loading} />
          <MetricCard label="セッション" value={totals ? formatNumber(totals.sessions) : undefined} hint={label} loading={loading} />
          <MetricCard label="直帰率" value={totals ? `${totals.bounceRate}` : undefined} suffix="%" loading={loading} />
          <MetricCard label="平均滞在時間" value={totals ? formatDuration(totals.avgDuration) : undefined} loading={loading} />
        </div>
      </section>

      <section>
        <LineChart data={daily} loading={loading} periodLabel={label} />
      </section>

      {showWeekly && !loading && weeklyData.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">週次サマリー</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {weeklyData.map((w, i) => {
              const mm = w.date.slice(4, 6);
              const dd = w.date.slice(6, 8);
              return (
                <div key={i} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500 mb-2">第{i + 1}週（{parseInt(mm)}/{parseInt(dd)}〜）</p>
                  <p className="text-xl font-bold text-white">{formatNumber(w.pageviews)}</p>
                  <p className="text-xs text-zinc-500">PV</p>
                  <p className="text-sm font-semibold text-emerald-400 mt-1">{formatNumber(w.sessions)}</p>
                  <p className="text-xs text-zinc-500">セッション</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <CreativeTable items={creatives} loading={loading} period={period} />
      </section>

      <section className={showQuickLinks ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
        <PageRanking items={pages} loading={loading} period={period} />
        {showQuickLinks && <WPQuickLinks />}
      </section>
    </div>
  );
}
