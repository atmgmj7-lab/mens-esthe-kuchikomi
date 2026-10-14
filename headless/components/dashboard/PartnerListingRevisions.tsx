"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./ListingApplications.module.css";

type Revision = { store_id: string; shop_slug: string; revision: number; shop_name: string; area: string; website_url: string; introduction: string | null; banner_asset_id?: string | null; current_public: string | null };
const text = (value: unknown) => typeof value === "string" ? value : "";

export function PartnerListingRevisions() {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [message, setMessage] = useState("本人編集の申請を読み込み中です。");
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => {
    const response = await fetch("/api/dashboard/partner-listing-revisions/", { cache: "no-store", credentials: "include" });
    const body = await response.json() as { ok?: boolean; revisions?: Revision[]; message?: string };
    if (!response.ok || !body.ok) throw new Error(body.message || "本人編集の申請を取得できませんでした。");
    setRevisions(Array.isArray(body.revisions) ? body.revisions : []);
    setMessage(body.revisions?.length ? "" : "確認待ちの本人編集はありません。");
  };
  useEffect(() => { void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "本人編集の申請を取得できませんでした。")); }, []);
  const review = async (item: Revision, decision: "approved" | "changes_requested") => {
    const note = window.prompt(decision === "approved" ? "承認メモ（任意）" : "差し戻し理由（店舗に表示されます）") ?? "";
    if (decision === "changes_requested" && !note.trim()) { setMessage("差し戻し理由を入力してください。"); return; }
    setBusy(item.store_id); setMessage("");
    try {
      const response = await fetch("/api/dashboard/partner-listing-revisions/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: item.store_id, revision: item.revision, decision, note }) });
      const body = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "審査結果を保存できませんでした。");
      setMessage(decision === "approved" ? "承認しました。同じ店舗 URL の公開内容を更新しました。" : "差し戻しました。公開中の内容は維持されます。");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "審査結果を保存できませんでした。"); } finally { setBusy(null); }
  };
  return <section className={styles.page} aria-labelledby="partner-listing-revisions-heading">
    <p className={styles.back}><Link href="/dashboard/listing-applications/">← 掲載申請一覧</Link></p>
    <div className={styles.hero}><div><p className={styles.eyebrow}>PARTNER CHANGE REVIEW</p><h2 id="partner-listing-revisions-heading">本人編集の改訂申請</h2><p>承認前は公開中の紹介文・バナーを維持します。差し戻し理由は店舗担当者だけに表示されます。</p></div></div>
    {message ? <p className={styles.notice} role="status">{message}</p> : null}
    <div className={styles.cards}>{revisions.map((item) => <RevisionCard item={item} busy={busy === item.store_id} review={review} key={item.store_id} />)}</div>
    <div className={styles.tableWrap}><table><thead><tr><th>店舗・改訂</th><th>公開中の紹介文</th><th>申請内容</th><th>判断</th></tr></thead><tbody>{revisions.map((item) => <tr key={item.store_id}><td><strong>{item.shop_name}</strong><small>{item.area} / revision {item.revision}</small><small><Link href={`/shops/${encodeURIComponent(item.shop_slug)}/`} target="_blank">公開ページ ↗</Link></small></td><td>{text(item.current_public) || "まだ公開版はありません。"}</td><td><strong>紹介文</strong><br />{text(item.introduction) || "未入力"}<br /><a href={item.website_url} target="_blank" rel="noreferrer">公式サイト ↗</a></td><td><ReviewButtons item={item} busy={busy === item.store_id} review={review} /></td></tr>)}</tbody></table></div>
  </section>;
}

function ReviewButtons({ item, busy, review }: { item: Revision; busy: boolean; review: (item: Revision, decision: "approved" | "changes_requested") => Promise<void> }) { return <div className={styles.review}><button type="button" disabled={busy} onClick={() => void review(item, "approved")}>承認して公開</button><button type="button" disabled={busy} onClick={() => void review(item, "changes_requested")}>差し戻し</button></div>; }
function RevisionCard({ item, busy, review }: { item: Revision; busy: boolean; review: (item: Revision, decision: "approved" | "changes_requested") => Promise<void> }) { return <article><p>revision {item.revision} / {item.area}</p><h3>{item.shop_name}</h3><p><strong>公開中の紹介文</strong><br />{text(item.current_public) || "まだ公開版はありません。"}</p><p><strong>申請内容</strong><br />{text(item.introduction) || "未入力"}</p><ReviewButtons item={item} busy={busy} review={review} /></article>; }
