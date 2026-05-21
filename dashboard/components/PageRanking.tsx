import type { PageMetric } from "@/lib/ga";
import { formatNumber } from "@/lib/ga";
import type { PeriodDays } from "@/lib/period";
import { periodLabel } from "@/lib/period";

type Props = {
  items: PageMetric[];
  loading?: boolean;
  error?: string;
  siteUrl?: string;
  period: PeriodDays;
};

export default function PageRanking({
  items,
  loading,
  error,
  siteUrl = "https://mens-esthe-kuchikomi.com",
  period,
}: Props) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 overflow-x-auto">
      <p className="text-sm font-medium text-zinc-300 mb-4">
        人気ページ TOP10（{periodLabel(period)}）
      </p>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-zinc-800" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">データがありません</p>
      ) : (
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 pr-3 font-medium">#</th>
              <th className="pb-2 pr-3 font-medium">ページ</th>
              <th className="pb-2 pr-3 font-medium">パス</th>
              <th className="pb-2 pr-3 font-medium text-right">PV</th>
              <th className="pb-2 font-medium text-right">セッション</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.path} className="border-b border-zinc-800/70 last:border-0">
                <td className="py-2.5 pr-3 text-zinc-500 tabular-nums">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <a href={`${siteUrl}${item.path}`} target="_blank" rel="noopener noreferrer" className="text-zinc-200 hover:text-indigo-400 transition-colors" title={item.title || item.path}>
                    {item.title || item.path}
                  </a>
                </td>
                <td className="py-2.5 pr-3 text-zinc-500 font-mono text-xs truncate max-w-[180px]">{item.path}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{formatNumber(item.pageviews)}</td>
                <td className="py-2.5 text-right tabular-nums text-emerald-400">{formatNumber(item.sessions ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
