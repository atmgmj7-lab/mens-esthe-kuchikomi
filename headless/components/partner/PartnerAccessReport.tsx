"use client";

import { useEffect, useMemo, useState } from "react";

type Daily = { observed_on: string; shop_view_count: number; official_line_click_count: number; has_data: boolean; has_recorded_data: boolean; measurement_state: "complete" | "partial" | "missing" | "unknown"; updated_at: string | null };
type Report = { days: number; from: string; to: string; previousFrom: string; previousTo: string; provisionalOn: string; rows: Daily[]; provisionalRows: Daily[] };

function total(rows: Daily[], field: "shop_view_count" | "official_line_click_count") {
  if (rows.some((row) => !row.has_data)) return null;
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

function displayTotal(value: number | null) { return value === null ? "比較不可" : value; }

function recordedTotal(rows: Daily[], field: "shop_view_count" | "official_line_click_count") {
  return rows.reduce((sum, row) => sum + (row.has_data || row.has_recorded_data ? Number(row[field]) || 0 : 0), 0);
}

export function PartnerAccessReport() {
  const [days, setDays] = useState(28); const [report, setReport] = useState<Report | null>(null); const [message, setMessage] = useState("読み込み中です。");
  const load = async (nextDays = days) => {
    setMessage("読み込み中です。");
    const response = await fetch(`/api/partner/access-report/?days=${nextDays}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok && Array.isArray(data.rows) && Array.isArray(data.provisionalRows)) { setReport(data); setMessage(""); } else setMessage(data?.message ?? "アクセス報告を取得できませんでした。");
  };
  useEffect(() => { void load(28); }, []);
  const split = useMemo(() => report ? { current: report.rows.slice(-report.days), previous: report.rows.slice(0, -report.days) } : null, [report]);
  const latest = report?.rows.filter((row) => row.updated_at).map((row) => row.updated_at).sort().at(-1) ?? null;
  return <section className="hl-partner-home__section" aria-labelledby="partner-access-report-heading">
    <div className="hl-partner-home__section-heading"><div><p className="hl-partner-home__eyebrow">ACCESS REPORT</p><h2 id="partner-access-report-heading">計測できた閲覧と公式LINEクリック</h2></div><p className="hl-partner-home__section-note">予約・来店・売上の数ではありません。</p></div>
    <p>この店舗の公開ページで計測できた閲覧と、公式LINEへのクリックだけを日ごとに匿名集計しています。広告ブロッカーなどで計測されない閲覧があり、全訪問の網羅を保証するものではありません。個別のIP、口コミ本文、編集控え、特典コードは保存・表示しません。</p>
    <label>期間 <select value={days} onChange={(event) => { const value = Number(event.target.value); setDays(value); void load(value); }}><option value={7}>直近7日</option><option value={28}>直近28日</option><option value={90}>直近90日</option></select></label>
    <button type="button" onClick={() => void load()}>更新する</button>
    {message ? <p role="status">{message}</p> : null}
    {report && split ? <>
      <dl className="hl-partner-home__metrics"><div className="hl-partner-home__metric"><dt>{report.from}〜{report.to}の閲覧</dt><dd>取得済み：{recordedTotal(split.current, "shop_view_count")}</dd><small>確定比較：{displayTotal(total(split.current, "shop_view_count"))}（前期間：{displayTotal(total(split.previous, "shop_view_count"))}）</small></div><div className="hl-partner-home__metric"><dt>公式LINEクリック</dt><dd>取得済み：{recordedTotal(split.current, "official_line_click_count")}</dd><small>確定比較：{displayTotal(total(split.current, "official_line_click_count"))}（前期間：{displayTotal(total(split.previous, "official_line_click_count"))}）</small></div></dl>
      <p>{report.provisionalOn}（本日・暫定）：閲覧 {recordedTotal(report.provisionalRows, "shop_view_count")}／公式LINEクリック {recordedTotal(report.provisionalRows, "official_line_click_count")}。本日の値は確定比較に含みません。</p>
      <p>{latest ? `最終集計更新：${new Date(latest).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}` : "まだ集計対象の日がありません。"}</p>
      <p>{split.current.some((row) => !row.has_data) || split.previous.some((row) => !row.has_data) ? "「不完全」「未計測」「未確認」は、アクセス計測の健全性を確認できない日です。取得済みの数値は表示しますが、確定比較には使いません。「0」はアクセス計測の独立した日次確認が完了したうえで、計測できた件数がなかった日だけを表します。" : "全日でアクセス計測の独立した日次確認が完了しています。0は計測できた件数がなかった日を表します。"}</p>
    </> : null}
  </section>;
}
