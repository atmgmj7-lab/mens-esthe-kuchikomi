import type { SearchConsoleAreaMetric } from "@/lib/searchConsole";
import { formatNumber, formatPercent } from "@/lib/ga";
import { periodLabel } from "@/lib/period";
import type { PeriodDays } from "@/lib/period";

type Props = {
  items: SearchConsoleAreaMetric[];
  loading?: boolean;
  period: PeriodDays;
  error?: string;
};

export default function AreaSeoTable({ items, loading, period, error }: Props) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 overflow-x-auto">
      <p className="text-sm font-medium text-zinc-300 mb-4">
        重点5エリアSEO状況（{periodLabel(period)}）
      </p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-zinc-800" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">データがありません</p>
      ) : (
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 pr-3 font-medium">エリア</th>
              <th className="pb-2 pr-3 font-medium text-right">対象キーワード</th>
              <th className="pb-2 pr-3 font-medium text-right">平均掲載順位</th>
              <th className="pb-2 pr-3 font-medium text-right">10位以内</th>
              <th className="pb-2 pr-3 font-medium text-right">20位以内</th>
              <th className="pb-2 pr-3 font-medium text-right">表示回数</th>
              <th className="pb-2 pr-3 font-medium text-right">クリック数</th>
              <th className="pb-2 pr-3 font-medium text-right">CTR</th>
              <th className="pb-2 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-zinc-800/70 last:border-0"
              >
                <td className="py-2.5 pr-3 text-zinc-200">{item.areaName}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{formatNumber(item.keywordCount)} / {formatNumber(item.pageCount)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{item.avgPosition > 0 ? item.avgPosition.toFixed(2) : "—"}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-400">{item.top10Count}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{item.top20Count}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{formatNumber(item.impressions)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{formatNumber(item.clicks)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-400">{formatPercent(item.ctr)}</td>
                <td className="py-2.5 text-zinc-500">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
