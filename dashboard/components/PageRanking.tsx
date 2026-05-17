import type { PageMetric } from "@/lib/ga";

type Props = {
  items: PageMetric[];
  loading?: boolean;
  error?: string;
  siteUrl?: string;
};

export default function PageRanking({
  items,
  loading,
  error,
  siteUrl = "https://mens-esthe-kuchikomi.com",
}: Props) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <p className="text-sm font-medium text-zinc-300 mb-4">
        人気ページ TOP10（30日）
      </p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="h-4 w-6 rounded bg-zinc-700 shrink-0" />
              <div className="h-4 flex-1 rounded bg-zinc-800" />
              <div className="h-4 w-16 rounded bg-zinc-700 shrink-0" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">データがありません</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.path} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-center text-xs font-bold text-zinc-500 shrink-0">
                {i + 1}
              </span>
              <a
                href={`${siteUrl}${item.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-zinc-300 hover:text-indigo-400 transition-colors"
                title={item.title || item.path}
              >
                {item.title || item.path}
              </a>
              <span className="text-xs text-zinc-400 shrink-0 tabular-nums">
                {item.pageviews.toLocaleString()} PV
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
