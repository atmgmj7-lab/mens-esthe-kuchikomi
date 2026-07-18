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
  type CreativeMetric,
  type DailyMetric,
  type PageMetric,
  type Totals,
} from "@/lib/ga";
import {
  fetchSearchConsoleKeywords,
  fetchSearchConsolePages,
  fetchSearchConsoleAreas,
  buildContentGapsFromSearchConsole,
  PRIORITY_AREAS,
  type SearchConsoleAreaMetric,
  type SearchConsoleKeywordMetric,
  type SearchConsolePageMetric,
} from "@/lib/searchConsole";
import type { PeriodDays } from "@/lib/period";
import { periodLabel } from "@/lib/period";
import { dashboardConfig } from "@/lib/dashboard-config";
import { isSupabaseReady } from "@/lib/dashboard-supabase";
import {
  dashboardUnavailableMessage,
  unavailableDashboardData,
  type DashboardDataResult,
  type DashboardDataSource,
} from "@/lib/dashboard/data-result";

type Props = {
  showWeekly?: boolean;
  showQuickLinks?: boolean;
};

type CtaSummary = {
  label: string;
  value: number;
  valueSecondary: string;
};

type ResultSummaryItem = {
  status: "live" | "unavailable";
  fetchedAt?: string;
  source: DashboardDataSource;
};

const CTA_PATTERNS = [
  { label: "LINEクリック", patterns: [/line|linenow|linel/, /line_click/i] },
  { label: "電話クリック", patterns: [/tel|phone|call|☎|☎️|電話/i] },
  { label: "公式サイトクリック", patterns: [/official|site|website|外部遷移|wp_click|official_click/i] },
  { label: "クーポン", patterns: [/coupon|クーポン|coupon_click/i] },
  { label: "問い合わせ", patterns: [/inquiry|contact|contact_click|問い合わせ|フォーム/i] },
];

const INITIAL_SOURCE: DashboardDataSource =
  dashboardConfig.dataSource === "supabase" ? "analytics-supabase" : "legacy-proxy";

function unavailable<T>(): DashboardDataResult<T> {
  return unavailableDashboardData(INITIAL_SOURCE, "not-configured");
}

function errorFor<T>(result: DashboardDataResult<T>): string | undefined {
  return result.status === "unavailable"
    ? dashboardUnavailableMessage(result.reason)
    : undefined;
}

function sourceName(source: DashboardDataSource): string {
  if (source === "analytics-supabase") return "分析用Supabase";
  if (source === "search-console") return "Search Console";
  if (source === "legacy-proxy") return "WordPress連携API";
  return "GA4";
}

function summarizeResults(results: ResultSummaryItem[]) {
  const live = results.filter((result) => result.status === "live");
  const newest = live
    .map((result) => result.fetchedAt ?? "")
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    liveCount: live.length,
    total: results.length,
    newest,
    source: sourceName(results[0]?.source ?? INITIAL_SOURCE),
  };
}

function formatFetchedAt(value?: string): string {
  if (!value) return "最終取得なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "取得日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function UnavailablePanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="dashboard-unavailable-panel" role="status">
      <p>{title}</p>
      <strong>未取得</strong>
      <small>{message}</small>
    </div>
  );
}

export default function AnalyticsDashboard({
  showWeekly = false,
  showQuickLinks = true,
}: Props) {
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [dailyResult, setDailyResult] = useState<DashboardDataResult<DailyMetric[]>>(
    unavailable
  );
  const [totalsResult, setTotalsResult] = useState<DashboardDataResult<Totals>>(
    unavailable
  );
  const [pagesResult, setPagesResult] = useState<DashboardDataResult<PageMetric[]>>(
    unavailable
  );
  const [creativesResult, setCreativesResult] = useState<DashboardDataResult<CreativeMetric[]>>(
    unavailable
  );
  const [ctaResult, setCtaResult] = useState<DashboardDataResult<CtaMetric[]>>(
    unavailable
  );
  const [scKeywordsResult, setScKeywordsResult] = useState<
    DashboardDataResult<SearchConsoleKeywordMetric[]>
  >(unavailable);
  const [scPagesResult, setScPagesResult] = useState<
    DashboardDataResult<SearchConsolePageMetric[]>
  >(unavailable);
  const [scAreasResult, setScAreasResult] = useState<
    DashboardDataResult<SearchConsoleAreaMetric[]>
  >(unavailable);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      fetchGA4Daily(period),
      fetchGA4Totals(period),
      fetchGA4Pages(period),
      fetchGA4Creatives(period),
      fetchGA4Cta(period),
      fetchSearchConsoleKeywords(period),
      fetchSearchConsolePages(period),
      fetchSearchConsoleAreas(period),
    ]).then(([daily, totals, pages, creatives, cta, scKeywords, scPages, scAreas]) => {
      if (!active) return;
      setDailyResult(daily);
      setTotalsResult(totals);
      setPagesResult(pages);
      setCreativesResult(creatives);
      setCtaResult(cta);
      setScKeywordsResult(scKeywords);
      setScPagesResult(scPages);
      setScAreasResult(scAreas);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [period]);

  const daily = dailyResult.status === "live" ? dailyResult.data : [];
  const totals = totalsResult.status === "live" ? totalsResult.data : null;
  const pages = pagesResult.status === "live" ? pagesResult.data : [];
  const creatives = creativesResult.status === "live" ? creativesResult.data : [];
  const cta = ctaResult.status === "live" ? ctaResult.data : [];
  const scKeywords = scKeywordsResult.status === "live" ? scKeywordsResult.data : [];
  const scPages = scPagesResult.status === "live" ? scPagesResult.data : [];
  const scAreas = scAreasResult.status === "live" ? scAreasResult.data : [];

  const ctaSummary = useMemo<CtaSummary[]>(() => {
    const normalized = cta.map((row) => ({
      name: row.eventName.toLowerCase(),
      count: row.count,
      sessions: row.sessions,
    }));

    return CTA_PATTERNS.map((target) => {
      const matched = normalized.filter((row) =>
        target.patterns.some((pattern) => pattern.test(row.name))
      );
      return {
        label: target.label,
        value: matched.reduce((sum, row) => sum + row.count, 0),
        valueSecondary: `${formatNumber(
          matched.reduce((sum, row) => sum + row.sessions, 0)
        )}セッション`,
      };
    });
  }, [cta]);

  const scPageSummary = useMemo(() => {
    const impressions = scPages.reduce((sum, item) => sum + item.impressions, 0);
    const clicks = scPages.reduce((sum, item) => sum + item.clicks, 0);
    const positions = scPages
      .filter((item) => item.impressions > 0)
      .map((item) => item.position);
    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      avgPosition:
        positions.length > 0
          ? positions.reduce((sum, position) => sum + position, 0) / positions.length
          : 0,
    };
  }, [scPages]);

  const scAreaSummary = useMemo(
    () => ({
      top10Keywords: scAreas.reduce((sum, item) => sum + item.top10Count, 0),
      areaCount: scAreas.filter((item) => item.status === "収集済み").length,
    }),
    [scAreas]
  );

  const weeklyData = useMemo(() => {
    if (!showWeekly || daily.length === 0) return [];
    return Array.from({ length: Math.ceil(daily.length / 7) }, (_, index) => {
      const slice = daily.slice(index * 7, index * 7 + 7);
      return {
        date: slice[0]?.date ?? "",
        pageviews: slice.reduce((sum, item) => sum + item.pageviews, 0),
        sessions: slice.reduce((sum, item) => sum + item.sessions, 0),
      };
    });
  }, [daily, showWeekly]);

  const contentGaps = useMemo(
    () => buildContentGapsFromSearchConsole(scPages),
    [scPages]
  );
  const gaSummary = summarizeResults([
    dailyResult,
    totalsResult,
    pagesResult,
    creativesResult,
    ctaResult,
  ]);
  const searchSummary = summarizeResults([
    scKeywordsResult,
    scPagesResult,
    scAreasResult,
  ]);
  const isSupabaseMode = dashboardConfig.dataSource === "supabase";
  const isSupabaseConfigured = isSupabaseReady();
  const label = periodLabel(period);
  const totalsError = errorFor(totalsResult);
  const scPagesError = errorFor(scPagesResult);
  const scAreasError = errorFor(scAreasResult);

  return (
    <div className="dashboard-cockpit space-y-6">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">Analytics Control Room</p>
          <h2>検索と回遊の現在地を、実データだけで確認。</h2>
          <p>
            GA4、Search Console、分析用Supabaseを混ぜずに表示します。取得できない項目は推測値で埋めず、未取得として残します。
          </p>
        </div>
        <div className="dashboard-source-grid" aria-label="データ取得状況">
          <article data-status={gaSummary.liveCount === gaSummary.total ? "live" : "unavailable"}>
            <span>GA4</span>
            <strong>{gaSummary.liveCount} / {gaSummary.total} 取得</strong>
            <small>{gaSummary.source}・{formatFetchedAt(gaSummary.newest)}</small>
          </article>
          <article data-status={searchSummary.liveCount === searchSummary.total ? "live" : "unavailable"}>
            <span>Search Console</span>
            <strong>{searchSummary.liveCount} / {searchSummary.total} 取得</strong>
            <small>{searchSummary.source}・{formatFetchedAt(searchSummary.newest)}</small>
          </article>
          <article data-status={isSupabaseConfigured ? "live" : "unavailable"}>
            <span>分析用Supabase</span>
            <strong>
              {isSupabaseConfigured ? "接続設定あり" : isSupabaseMode ? "未設定" : "現在は未使用"}
            </strong>
            <small>分析データの読み取り専用</small>
          </article>
        </div>
      </section>

      <div className="dashboard-period-row">
        <PeriodSelector value={period} onChange={setPeriod} />
        <p>表示期間: <strong>{label}</strong></p>
      </div>

      <section aria-labelledby="ga-summary-heading">
        <h2 id="ga-summary-heading" className="dashboard-section-heading">
          GA4 全体サマリー
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 dashboard-metric-grid">
          <MetricCard
            label="ページビュー"
            value={totals ? formatNumber(totals.pageviews) : undefined}
            hint={label}
            loading={loading}
            error={totalsError}
          />
          <MetricCard
            label="セッション"
            value={totals ? formatNumber(totals.sessions) : undefined}
            hint={label}
            loading={loading}
            error={totalsError}
          />
          <MetricCard
            label="直帰率"
            value={totals ? formatPercent(totals.bounceRate) : undefined}
            loading={loading}
            error={totalsError}
          />
          <MetricCard
            label="平均滞在時間"
            value={totals ? formatDuration(totals.avgDuration) : undefined}
            loading={loading}
            error={totalsError}
          />
        </div>
      </section>

      <section aria-labelledby="search-summary-heading">
        <h2 id="search-summary-heading" className="dashboard-section-heading">
          Search Console サマリー
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 dashboard-metric-grid">
          <MetricCard
            label="表示回数"
            value={formatNumber(scPageSummary.impressions)}
            loading={loading}
            error={scPagesError}
          />
          <MetricCard
            label="クリック"
            value={formatNumber(scPageSummary.clicks)}
            loading={loading}
            error={scPagesError}
          />
          <MetricCard
            label="CTR"
            value={formatPercent(scPageSummary.ctr)}
            loading={loading}
            error={scPagesError}
          />
          <MetricCard
            label="平均掲載順位"
            value={scPageSummary.avgPosition > 0 ? scPageSummary.avgPosition.toFixed(2) : "—"}
            loading={loading}
            error={scPagesError}
          />
          <MetricCard
            label="10位以内キーワード数"
            value={scAreaSummary.top10Keywords}
            suffix="件"
            loading={loading}
            error={scAreasError}
          />
        </div>
      </section>

      <section className="dashboard-pdca" aria-label="分析の使い方">
        <article>
          <h3>検索結果を整える</h3>
          <p>表示回数が多くCTRが低いページから、見出しと説明文を確認します。</p>
        </article>
        <article>
          <h3>店舗ページを補強する</h3>
          <p>ページ別PVと予約導線の実測を見て、情報追加の順番を決めます。</p>
        </article>
        <article>
          <h3>取得状況を分けて見る</h3>
          <p>一部の取得失敗を別データで補完せず、各パネルの状態を個別に確認します。</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ctaResult.status === "unavailable" ? (
          <UnavailablePanel title="CTA計測（GA4）" message={dashboardUnavailableMessage(ctaResult.reason)} />
        ) : (
          <div className="dashboard-data-panel">
            <p>CTA計測（GA4）</p>
            <dl className="dashboard-definition-list">
              {ctaSummary.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{formatNumber(item.value)} / {item.valueSecondary}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {scAreasResult.status === "unavailable" ? (
          <UnavailablePanel title="重点5エリア" message={dashboardUnavailableMessage(scAreasResult.reason)} />
        ) : (
          <div className="dashboard-data-panel">
            <p>重点5エリア（取得数）</p>
            <strong className="dashboard-large-number">
              {scAreaSummary.areaCount} / {PRIORITY_AREAS.length}
            </strong>
            <small>Search Consoleで収集済みの重点エリア</small>
          </div>
        )}
      </section>

      <section>
        <LineChart
          data={daily}
          loading={loading}
          periodLabel={label}
          error={errorFor(dailyResult)}
        />
      </section>

      {showWeekly && !loading && (
        <section aria-labelledby="weekly-heading">
          <h2 id="weekly-heading" className="dashboard-section-heading">週次サマリー</h2>
          {dailyResult.status === "unavailable" ? (
            <UnavailablePanel title="週次サマリー" message={dashboardUnavailableMessage(dailyResult.reason)} />
          ) : weeklyData.length === 0 ? (
            <div className="dashboard-data-panel"><p>対象期間のデータは0件です。</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 dashboard-metric-grid">
              {weeklyData.map((week, index) => (
                <div key={`${week.date}-${index}`} className="dashboard-data-panel">
                  <small>第{index + 1}週</small>
                  <strong className="dashboard-weekly-value">{formatNumber(week.pageviews)} PV</strong>
                  <span>{formatNumber(week.sessions)} セッション</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaSeoTable
          items={scAreas}
          loading={loading}
          period={period}
          error={errorFor(scAreasResult)}
        />
        {scPagesResult.status === "unavailable" ? (
          <UnavailablePanel title={`改善候補（${label}）`} message={dashboardUnavailableMessage(scPagesResult.reason)} />
        ) : (
          <ContentGapPanel pages={contentGaps} periodLabel={label} />
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SearchKeywordTable
          items={scKeywords}
          loading={loading}
          period={period}
          error={errorFor(scKeywordsResult)}
        />
        <PageRanking
          items={pages}
          loading={loading}
          period={period}
          error={errorFor(pagesResult)}
        />
      </section>

      <section className={showQuickLinks ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
        {showQuickLinks && <WPQuickLinks />}
        <CreativeTable
          items={creatives}
          loading={loading}
          period={period}
          error={errorFor(creativesResult)}
        />
      </section>
    </div>
  );
}
