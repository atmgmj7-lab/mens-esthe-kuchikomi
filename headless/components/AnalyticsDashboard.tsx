"use client";

import { useEffect, useMemo, useState } from "react";
import MetricCard from "@/components/MetricCard";
import LineChart from "@/components/LineChart";
import PageRanking from "@/components/PageRanking";
import CreativeTable from "@/components/CreativeTable";
import PeriodSelector from "@/components/PeriodSelector";
import WPQuickLinks from "@/components/WPQuickLinks";
import AreaSeoTable from "@/components/AreaSeoTable";
import SearchKeywordTable from "@/components/SearchKeywordTable";
import ContentGapPanel from "@/components/ContentGapPanel";
import {
  fetchGA4Daily,
  fetchGA4Totals,
  fetchGA4Pages,
  fetchGA4Creatives,
  fetchGA4Cta,
  formatDuration,
  formatNumber,
  formatPercent,
  type CtaMetric,
  type DailyMetric,
  type Totals,
  type PageMetric,
  type CreativeMetric,
} from "@/lib/ga";
import {
  fetchSearchConsoleKeywords,
  fetchSearchConsolePages,
  fetchSearchConsoleAreas,
  buildContentGapsFromSearchConsole,
  PRIORITY_AREAS,
  type SearchConsoleKeywordMetric,
  type SearchConsolePageMetric,
  type SearchConsoleAreaMetric,
} from "@/lib/searchConsole";
import type { PeriodDays } from "@/lib/period";
import { periodLabel } from "@/lib/period";
import { dashboardConfig } from "@/lib/dashboard-config";
import { isSupabaseReady } from "@/lib/dashboard-supabase";

type Props = {
  showWeekly?: boolean;
  showQuickLinks?: boolean;
};

type CtaSummary = {
  label: string;
  value: number;
  valueSecondary: string;
};

const CTA_PATTERNS = [
  { key: "line", label: "LINEクリック", patterns: [/line|linenow|linel/, /line_click/i] },
  { key: "tel", label: "電話クリック", patterns: [/tel|phone|call|☎|☎️|電話/i] },
  { key: "site", label: "公式サイトクリック", patterns: [/official|site|website|外部遷移|wp_click|official_click/i] },
  { key: "coupon", label: "クーポン", patterns: [/coupon|クーポン|coupon_click/i] },
  { key: "inquiry", label: "問い合わせ", patterns: [/inquiry|contact|contact_click|問い合わせ|フォーム/i] },
];

export default function AnalyticsDashboard({
  showWeekly = false,
  showQuickLinks = true,
}: Props) {
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [pages, setPages] = useState<PageMetric[]>([]);
  const [creatives, setCreatives] = useState<CreativeMetric[]>([]);
  const [cta, setCta] = useState<CtaMetric[]>([]);
  const [scKeywords, setScKeywords] = useState<SearchConsoleKeywordMetric[]>([]);
  const [scPages, setScPages] = useState<SearchConsolePageMetric[]>([]);
  const [scAreas, setScAreas] = useState<SearchConsoleAreaMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    setErrors([]);

    Promise.allSettled([
      fetchGA4Daily(period),
      fetchGA4Totals(period),
      fetchGA4Pages(period),
      fetchGA4Creatives(period),
      fetchGA4Cta(period),
      fetchSearchConsoleKeywords(period),
      fetchSearchConsolePages(period),
      fetchSearchConsoleAreas(period),
    ]).then((results) => {
      const errs: string[] = [];

      const [d, t, p, c, gaCta, scK, scP, scA] = results;

      if (d.status === "fulfilled") {
        setDaily(d.value);
      } else {
        errs.push("GA4日次データ");
      }
      if (t.status === "fulfilled") {
        setTotals(t.value);
      } else {
        errs.push("GA4集計");
      }
      if (p.status === "fulfilled") {
        setPages(p.value);
      } else {
        errs.push("GA4ページ別");
      }
      if (c.status === "fulfilled") {
        setCreatives(c.value);
      } else {
        errs.push("GA4広告別");
      }
      if (gaCta.status === "fulfilled") {
        setCta(gaCta.value);
      } else {
        errs.push("GA4 CTA");
      }
      if (scK.status === "fulfilled") {
        setScKeywords(scK.value);
      } else {
        errs.push("Search Console キーワード");
      }
      if (scP.status === "fulfilled") {
        setScPages(scP.value);
      } else {
        errs.push("Search Console ページ");
      }
      if (scA.status === "fulfilled") {
        setScAreas(scA.value);
      } else {
        errs.push("Search Console エリア");
      }

      setErrors(errs);
      setLoading(false);
    });
  }, [period]);

  const ctaSummary = useMemo<CtaSummary[]>(() => {
    const base = CTA_PATTERNS.map((item) => ({
      label: item.label,
      value: 0,
      valueSecondary: "0",
    }));

    const normalized = cta.map((row) => ({
      name: row.eventName.toLowerCase(),
      count: row.count,
      sessions: row.sessions,
    }));

    const withValues = base.map((row) => {
      const matched = normalized.filter((c) =>
        CTA_PATTERNS.find((target) => target.label === row.label)?.patterns.some((p) =>
          p.test(c.name)
        )
      );

      const sum = matched.reduce((s, n) => s + n.count, 0);
      const sessions = matched.reduce((s, n) => s + n.sessions, 0);

      return {
        label: row.label,
        value: sum,
        valueSecondary: `${formatNumber(sessions)}セッション`,
      };
    });

    return withValues;
  }, [cta]);

  const scSummary = useMemo(() => {
    const impressions = scPages.reduce((s, item) => s + item.impressions, 0);
    const clicks = scPages.reduce((s, item) => s + item.clicks, 0);
    const positions = scPages
      .filter((item) => item.impressions > 0)
      .map((item) => item.position);
    const avgPosition =
      positions.length === 0
        ? 0
        : positions.reduce((sum, value) => sum + value, 0) / positions.length;

    const top10Keywords = scAreas.reduce((s, item) => s + item.top10Count, 0);

    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      avgPosition,
      top10Keywords,
      areaCount: scAreas.filter((item) => item.status === "収集済み").length,
    };
  }, [scPages, scAreas]);

  const priorityAreaRows = useMemo(() => {
    if (scAreas.length > 0) {
      return scAreas;
    }

    return PRIORITY_AREAS.map((area) => ({
      id: area.id,
      areaName: area.name,
      keywordCount: 0,
      pageCount: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      avgPosition: 0,
      top10Count: 0,
      top20Count: 0,
      status: "データ不足" as const,
      keywordSamples: [],
    }));
  }, [scAreas]);

  const gaps = buildContentGapsFromSearchConsole(scPages);
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

  const label = periodLabel(period);
  const isGAUnlinked = totals?._mock === true;
  const isSupabaseMode = dashboardConfig.dataSource === "supabase";
  const isSupabaseConfigured = isSupabaseReady();
  const isSupabase = isSupabaseMode && isSupabaseConfigured;
  const hasLiveDataSource = isSupabaseMode ? isSupabase : !isGAUnlinked;
  const liveTotals = hasLiveDataSource && totals && !totals._mock ? totals : null;
  const liveDaily = hasLiveDataSource ? daily : [];
  const livePages = hasLiveDataSource ? pages : [];
  const liveCreatives = hasLiveDataSource ? creatives : [];
  const liveKeywords = hasLiveDataSource ? scKeywords : [];
  const liveAreas = hasLiveDataSource ? priorityAreaRows : priorityAreaRows.map((area) => ({
    ...area,
    keywordCount: 0,
    pageCount: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    avgPosition: 0,
    top10Count: 0,
    top20Count: 0,
    status: "データ不足" as const,
    keywordSamples: [],
  }));
  const liveGaps = hasLiveDataSource ? gaps : [];
  const liveWeeklyData = hasLiveDataSource ? weeklyData : [];
  const liveScSummary = hasLiveDataSource
    ? scSummary
    : {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        avgPosition: 0,
        top10Keywords: 0,
        areaCount: 0,
      };
  const liveCtaSummary = hasLiveDataSource
    ? ctaSummary
    : CTA_PATTERNS.map((item) => ({
        label: item.label,
        value: 0,
        valueSecondary: "未連携",
      }));
  const searchConsoleConnected = hasLiveDataSource && scAreas.length > 0;
  const dashboardReadiness = [
    {
      label: "本番URL",
      value: "/dashboard/",
      state: "Vercel配信",
    },
    {
      label: "データ正本",
      value: isSupabase ? "Supabase" : "未連携",
      state: isSupabase ? "実データ優先" : "環境変数待ち",
    },
    {
      label: "認証",
      value: "Basic Auth",
      state: "Vercel envで制御",
    },
  ];
  const pdcaActions = [
    {
      title: "SEO順位を伸ばす",
      body: "表示回数が多くCTRが低いページから、title、description、FAQ、内部リンクを直す。",
    },
    {
      title: "掲載ページを強くする",
      body: "店舗詳細、エリアページ、ランキング導線のPVとCTAを見て、次に補強するページを決める。",
    },
    {
      title: "AIで壁打ちする",
      body: "Search Consoleの課題をプロンプト化し、Claude Code / Codexに改善案や記事構成を投げる。",
    },
  ];
  const aiPromptSeeds = [
    "Search Consoleで表示回数が多くCTRが低いページのタイトル案を10個作って",
    "日本橋・梅田・新大阪のエリアページで足りない見出しとFAQを洗い出して",
    "今週のGA4とSearch Consoleを見て、次に直すべき3ページを優先順位付きで提案して",
  ];

  return (
    <div className="dashboard-cockpit space-y-6">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">Next.js / Supabase / Vercel</p>
          <h2>ポータル成長の作戦盤</h2>
          <p>
            アナリティクス、Search Console、SEO改善、コンテンツ作成、AI壁打ちを同じ画面で回すための管理画面です。
          </p>
        </div>
        <div className="dashboard-readiness">
          {dashboardReadiness.map((item) => (
            <div key={item.label} className="dashboard-readiness-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.state}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="flex flex-wrap gap-2 text-xs">
          {isGAUnlinked ? (
            <span className="px-2 py-1 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
              GA4未連携（数値非表示）
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800">
              GA4連携あり
            </span>
          )}
          {isSupabaseMode ? (
            isSupabase ? (
              <span className="px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800">
                データ元: Supabase
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full bg-red-900/40 text-red-300 border border-red-800">
                データ元: Supabase未設定
              </span>
            )
          ) : (
            <span className="px-2 py-1 rounded-full bg-zinc-900/60 text-zinc-300 border border-zinc-700">
              データ元: WordPress連携
            </span>
          )}
          {searchConsoleConnected ? (
            <span className="px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800">
              Search Console接続
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
              Search Console未接続
            </span>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-800 bg-red-950/30 text-red-300 p-4 text-sm">
          連携で一部未取得があります：{errors.join("、")}。
        </div>
      )}

      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          {label}の全体サマリー
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="ページビュー"
            value={liveTotals ? formatNumber(liveTotals.pageviews) : undefined}
            hint={label}
            loading={loading}
          />
          <MetricCard
            label="セッション"
            value={liveTotals ? formatNumber(liveTotals.sessions) : undefined}
            hint={label}
            loading={loading}
          />
          <MetricCard
            label="直帰率"
            value={liveTotals ? formatPercent(liveTotals.bounceRate) : undefined}
            suffix=""
            loading={loading}
          />
          <MetricCard
            label="平均滞在時間"
            value={liveTotals ? formatDuration(liveTotals.avgDuration) : undefined}
            loading={loading}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Search Consoleサマリー（{label}）
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard label="表示回数" value={formatNumber(liveScSummary.impressions)} loading={loading} />
          <MetricCard label="クリック" value={formatNumber(liveScSummary.clicks)} loading={loading} />
          <MetricCard label="CTR" value={formatPercent(liveScSummary.ctr)} suffix="" loading={loading} />
          <MetricCard
            label="平均掲載順位"
            value={liveScSummary.avgPosition > 0 ? liveScSummary.avgPosition.toFixed(2) : "—"}
            loading={loading}
          />
          <MetricCard
            label="10位以内キーワード数"
            value={liveScSummary.top10Keywords}
            suffix="件"
            loading={loading}
          />
        </div>
      </section>

      <section className="dashboard-pdca">
        {pdcaActions.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <p className="text-sm font-medium text-zinc-300 mb-4">CTA計測（GA4）</p>
          <div className="space-y-3">
            {liveCtaSummary.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{item.label}</span>
                <span className="tabular-nums text-zinc-100">{formatNumber(item.value)} / {item.valueSecondary}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <p className="text-sm font-medium text-zinc-300 mb-3">重点5エリア（取得数）</p>
          <p className="text-3xl font-bold text-white">{liveScSummary.areaCount} / {PRIORITY_AREAS.length}</p>
          <p className="text-xs text-zinc-500 mt-2">「重点5エリア」のうち、Search Consoleデータがあるエリア</p>
        </div>
      </section>

      <section>
        <LineChart data={liveDaily} loading={loading} periodLabel={label} />
      </section>

      <section className="dashboard-ai-panel">
        <div>
          <p className="dashboard-eyebrow">AI Workbench</p>
          <h3>Claude Code / Codex に渡す壁打ちメモ</h3>
          <p>
            実データが入ったら、改善候補・順位・CTAをもとに、この欄をそのままAIへの相談内容として使えるようにします。
          </p>
        </div>
        <div className="dashboard-prompt-list">
          {aiPromptSeeds.map((prompt) => (
            <button key={prompt} type="button">
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {showWeekly && !loading && liveWeeklyData.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">週次サマリー</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {liveWeeklyData.map((w, i) => {
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

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaSeoTable items={liveAreas} loading={loading} period={period} />
        <ContentGapPanel pages={liveGaps} periodLabel={label} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SearchKeywordTable items={liveKeywords} loading={loading} period={period} />
        <PageRanking items={livePages} loading={loading} period={period} />
      </section>

      <section className={showQuickLinks ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
        {showQuickLinks && <WPQuickLinks />}
        <CreativeTable items={liveCreatives} loading={loading} period={period} />
      </section>
    </div>
  );
}
