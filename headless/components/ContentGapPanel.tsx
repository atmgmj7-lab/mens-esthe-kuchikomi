import type { SearchConsolePageMetric } from "@/lib/searchConsole";
import { formatNumber, formatPercent } from "@/lib/ga";

import { buildContentGapsFromSearchConsole } from "@/lib/searchConsole";

type Suggestion = {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  reasons: string[];
  suggestion: string;
};

type Props = {
  pages: SearchConsolePageMetric[];
  periodLabel: string;
};

function buildSuggestions(rows: SearchConsolePageMetric[]): Suggestion[] {
  return buildContentGapsFromSearchConsole(rows).map((row) => {
    const reasons: string[] = [];

    if (row.position > 20) {
      reasons.push("掲載順位が20位以下");
    }
    if (row.ctr < 3) {
      reasons.push("CTRが3%未満");
    }
    if (row.impressions >= 800) {
      reasons.push("表示回数が高く、上位化余地が大きい");
    }

    const suggestion = row.position > 15
      ? "タイトル・説明文の最適化とFAQ補強を提案"
      : "検索意図に寄せた見出し追加と内部リンク補強を提案";

    return {
      page: row.path,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      reasons,
      suggestion,
    };
  });
}

export default function ContentGapPanel({ pages, periodLabel }: Props) {
  const rows = buildSuggestions(pages);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <p className="text-sm font-medium text-zinc-300 mb-3">改善候補（{periodLabel}）</p>
        <p className="text-sm text-zinc-500">現時点では優先改善候補は見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
      <div>
        <p className="text-sm font-medium text-zinc-300 mb-2">改善候補（{periodLabel}）</p>
        <p className="text-xs text-zinc-500">表示回数が多い順 + 低CTR/高順位で優先順位化</p>
      </div>

      <div className="space-y-3">
        {rows.slice(0, 8).map((item, i) => (
          <div key={item.page} className="rounded-lg border border-zinc-800 p-4 bg-zinc-950/80">
            <p className="text-xs text-zinc-400">候補{String(i + 1).padStart(2, "0")}</p>
            <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{item.page}</p>
            <dl className="mt-2 text-xs text-zinc-500 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
              <div>表示回数: <span className="text-zinc-200 tabular-nums">{formatNumber(item.impressions)}</span></div>
              <div>クリック: <span className="text-zinc-200 tabular-nums">{formatNumber(item.clicks)}</span></div>
              <div>CTR: <span className="text-zinc-200 tabular-nums">{formatPercent(item.ctr)}</span></div>
              <div>平均掲載順位: <span className="text-zinc-200 tabular-nums">{item.position > 0 ? item.position.toFixed(1) : "—"}</span></div>
            </dl>
            <p className="text-xs text-zinc-400 mt-2">
              原因: {item.reasons.join(" / ")}
            </p>
            <p className="text-xs text-emerald-400 mt-1">
              自動提案: {item.suggestion}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
