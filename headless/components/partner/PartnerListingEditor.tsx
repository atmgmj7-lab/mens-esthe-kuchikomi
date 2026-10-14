"use client";

import { useEffect, useState } from "react";

type Listing = { store_id: string; shop_slug: string; canonical_url: string; current_revision: number; revision: { state: "draft" | "submitted" | "changes_requested" | "approved"; shop_name: string; area: string; website_url: string; introduction: string | null; banner_asset_id: string | null }; latest_review: { decision: string; note: string | null } | null };

const labels = { draft: "下書き", submitted: "承認待ち", changes_requested: "差し戻し", approved: "承認済み" } as const;

export function PartnerListingEditor() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [message, setMessage] = useState("読み込み中です。");
  const [busy, setBusy] = useState(false);
  const [bannerAssetId, setBannerAssetId] = useState<string | null>(null);
  const load = async () => {
    const response = await fetch("/api/partner/listing/", { cache: "no-store", credentials: "include" });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.message || "編集内容を取得できませんでした。");
    setListing(body.listing as Listing); setMessage("");
  };
  useEffect(() => { void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "編集内容を取得できませんでした。")); }, []);
  const save = async (submit: boolean, form?: HTMLFormElement) => {
    if (!listing || busy) return; setBusy(true); setMessage("");
    try {
      const source = form ? new FormData(form) : null;
      if (!submit) {
        const response = await fetch("/api/partner/listing/", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: listing.current_revision, shopName: source?.get("shopName"), area: source?.get("area"), websiteUrl: source?.get("websiteUrl"), introduction: source?.get("introduction"), bannerAssetId: bannerAssetId ?? listing.revision.banner_asset_id }) });
        const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.message || "下書きを保存できませんでした。"); setMessage(body.message);
      } else {
        const response = await fetch("/api/partner/listing/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: listing.current_revision }) });
        const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.message || "変更申請を送信できませんでした。"); setMessage(body.message);
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存できませんでした。"); } finally { setBusy(false); }
  };
  const uploadBanner = async (file: File) => {
    if (busy) return; setBusy(true); setMessage("");
    try { const form = new FormData(); form.set("banner", file); const response = await fetch("/api/partner/listing/banner/", { method: "POST", credentials: "include", body: form }); const body = await response.json() as { ok?: boolean; assetId?: string; message?: string }; if (!response.ok || !body.ok || !body.assetId) throw new Error(body.message || "画像を保存できませんでした。"); setBannerAssetId(body.assetId); setMessage("画像を保管しました。下書きを保存してから変更を申請してください。"); } catch (error) { setMessage(error instanceof Error ? error.message : "画像を保存できませんでした。"); } finally { setBusy(false); }
  };
  if (!listing) return <main id="main_content" className="l-mainContent l-article"><div className="l-mainContent__inner hl-page-inner"><p role="status">{message}</p></div></main>;
  const editable = listing.revision.state === "draft" || listing.revision.state === "changes_requested";
  return <main id="main_content" className="l-mainContent l-article"><div className="l-mainContent__inner hl-page-inner"><header><p>掲載情報の本人編集</p><h1>{listing.revision.shop_name}</h1><p>状態：{labels[listing.revision.state]}</p><p><a href={listing.canonical_url}>現在の公開ページを確認</a></p></header>{listing.latest_review?.decision === "changes_requested" ? <section><h2>差し戻し理由</h2><p>{listing.latest_review.note || "運営から内容の確認依頼があります。"}</p></section> : null}<form onSubmit={(event) => { event.preventDefault(); void save(false, event.currentTarget); }}><label>店舗名<input name="shopName" maxLength={120} required defaultValue={listing.revision.shop_name} disabled={!editable || busy} /></label><label>地域<input name="area" maxLength={120} required defaultValue={listing.revision.area} disabled={!editable || busy} /></label><label>公式URL<input name="websiteUrl" type="url" required defaultValue={listing.revision.website_url} disabled={!editable || busy} /></label><label>紹介文<textarea name="introduction" maxLength={5000} rows={8} defaultValue={listing.revision.introduction || ""} disabled={!editable || busy} /></label><label>店舗バナー（PNG / JPEG / WebP、5MBまで）<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable || busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadBanner(file); }} /></label><p>{bannerAssetId || listing.revision.banner_asset_id ? "バナー画像は下書きに設定されています。承認後にだけ公開されます。" : "店舗バナーは、承認済みの画像だけを公開します。"}</p>{editable ? <button type="submit" disabled={busy}>下書きを保存</button> : null}</form>{listing.revision.state === "draft" ? <button type="button" disabled={busy} onClick={() => void save(true)}>変更を申請する</button> : null}<p role="status">{message}</p></div></main>;
}
