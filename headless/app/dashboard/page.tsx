import Link from "next/link";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function DashboardPage() {
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
          <h1 className="text-lg font-bold text-white">mens-esthe-kuchikomi</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{today}</p>
        </div>
        <Link
          href="/dashboard/analytics"
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          詳細分析 →
        </Link>
      </header>
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <AnalyticsDashboard />
      </main>
      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-600 text-center">
        mens-esthe-kuchikomi 管理ダッシュボード
      </footer>
    </div>
  );
}
