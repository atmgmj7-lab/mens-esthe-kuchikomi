import type { CreativeMetric } from "@/lib/ga";
import { formatDuration, formatNumber, formatPercent } from "@/lib/ga";
import type { PeriodDays } from "@/lib/period";
import { periodLabel } from "@/lib/period";

type Props = {
  items: CreativeMetric[];
  loading?: boolean;
  error?: string;
  period: PeriodDays;
};

export default function CreativeTable({ items, loading, error, period }: Props) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 overflow-x-auto">
      <p className="text-sm font-medium text-zinc-300 mb-4">
        広告クリエイティブ別（{periodLabel(period)}）
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
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 pr-3 font-medium">#</th>
              <th className="pb-2 pr-3 font-medium">クリエイティブ</th>
              <th className="pb-2 pr-3 font-medium">キャンペーン</th>
              <th className="pb-2 pr-3 font-medium text-right">PV</th>
              <th className="pb-2 pr-3 font-medium text-right">セッション</th>
              <th className="pb-2 pr-3 font-medium text-right">ユーザー</th>
              <th className="pb-2 pr-3 font-medium text-right">直帰率</th>
              <th className="pb-2 font-medium text-right">平均滞在</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={`${item.campaign}-${item.creative}`} className="border-b border-zinc-800/70 last:border-0">
                <td className="py-2.5 pr-3 text-zinc-500 tabular-nums">{i + 1}</td>
                <td className="py-2.5 pr-3 text-zinc-200 font-medium">{item.creative}</td>
                <td className="py-2.5 pr-3 text-zinc-400">{item.campaign}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{formatNumber(item.pageviews)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-400">{formatNumber(item.sessions)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{formatNumber(item.users)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-400">{formatPercent(item.bounceRate)}</td>
                <td className="py-2.5 text-right tabular-nums text-zinc-400">{formatDuration(item.avgDuration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
