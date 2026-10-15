"use client";

import { FormEvent, useState } from "react";
import styles from "./OperatorShops.module.css";

type Payload = Record<string, string | number | null | string[]>;
const UUID = /^[0-9a-f-]{36}$/i;
const fields = [
  ["shop_name", "店舗名"], ["area_slug", "エリアslug"], ["area_name", "エリア名"], ["official_url", "公式URL"],
  ["introduction", "紹介文"], ["address", "住所"], ["business_hours", "営業時間"], ["phone", "電話番号"],
  ["line_url", "LINE URL"], ["booking_url", "予約URL"], ["basic_price", "基本料金"], ["price_90", "90分料金"],
] as const;

function value(form: HTMLFormElement): Payload {
  const raw = new FormData(form);
  const price = (key: "basic_price" | "price_90") => {
    const item = String(raw.get(key) ?? "").trim(); return item ? Number(item) : null;
  };
  return {
    shop_name: String(raw.get("shop_name") ?? "").trim(), area_slug: String(raw.get("area_slug") ?? "").trim(), area_name: String(raw.get("area_name") ?? "").trim(), official_url: String(raw.get("official_url") ?? "").trim() || null,
    introduction: String(raw.get("introduction") ?? "").trim() || null, address: String(raw.get("address") ?? "").trim() || null, business_hours: String(raw.get("business_hours") ?? "").trim() || null, phone: String(raw.get("phone") ?? "").trim() || null,
    line_url: String(raw.get("line_url") ?? "").trim() || null, booking_url: String(raw.get("booking_url") ?? "").trim() || null,
    basic_price: price("basic_price"), price_90: price("price_90"), banner_asset_id: String(raw.get("banner_asset_id") ?? "").trim() || null,
    gallery_asset_ids: String(raw.get("gallery_asset_ids") ?? "").split(",").map((id) => id.trim()).filter((id) => UUID.test(id)),
  };
}

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/dashboard/managed-shops/", { method: "POST", headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": "managed-shop-write" }, body: JSON.stringify(body) });
  const result = await response.json() as { ok?: boolean; message?: string; managedShopId?: string };
  return { ok: response.ok && result.ok === true, message: result.message, managedShopId: result.managedShopId };
}

export function ManagedShopCreateForm() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("下書きを作成しています…");
    const form = event.currentTarget; const slug = String(new FormData(form).get("slug") ?? "").trim();
    const result = await post({ action: "create", slug, payload: value(form) });
    if (result.ok && result.managedShopId) { window.location.assign(`/dashboard/shops/managed/${result.managedShopId}/`); return; }
    setMessage(result.message || "新規店舗を作成できませんでした。");
  }
  return <section className={styles.formPanel}><p className={styles.eyebrow}>新規店舗</p><h2>店舗を下書きで追加</h2><p className={styles.note}>この保存だけでは公開されません。内容を確認して申請・承認した後に公開できます。</p><ShopForm onSubmit={submit} submitLabel="下書きを作成する" message={message} includeSlug /></section>;
}

export function ManageLegacyShopButton({ wpShopId }: { wpShopId: number }) {
  const [message, setMessage] = useState("");
  async function start() {
    setMessage("既存情報を読み込み、管理用下書きを作成しています…");
    const result = await post({ action: "import_legacy", wpShopId });
    if (result.ok && result.managedShopId) { window.location.assign(`/dashboard/shops/managed/${result.managedShopId}/`); return; }
    setMessage(result.message || "管理用下書きを作成できませんでした。");
  }
  return <div className={styles.saveGate}><button type="button" onClick={start}>Web管理で編集する</button>{message ? <p role="status">{message}</p> : null}</div>;
}

export function ManagedShopEditorForm({ managedShopId, revision, initial, publicationState }: { managedShopId: string; revision: number; initial: Payload; publicationState: "published" | "unlisted" }) {
  const [message, setMessage] = useState(""); const [assetId, setAssetId] = useState(typeof initial.banner_asset_id === "string" ? initial.banner_asset_id : ""); const [galleryAssetIds, setGalleryAssetIds] = useState(Array.isArray(initial.gallery_asset_ids) ? initial.gallery_asset_ids.filter((id): id is string => typeof id === "string" && UUID.test(id)) : []); const [reviewNote, setReviewNote] = useState("");
  async function action(next: "save" | "submit" | "approved" | "changes_requested" | "published" | "unlisted", form?: HTMLFormElement) {
    if (next === "save" && !form) return; setMessage("処理しています…");
    const base = { managedShopId, expectedRevision: revision };
    const result = next === "save" ? await post({ action: "save", ...base, payload: { ...value(form as HTMLFormElement), banner_asset_id: assetId || null } })
      : next === "submit" ? await post({ action: "submit", ...base })
        : next === "published" || next === "unlisted" ? await post({ action: "visibility", ...base, visibility: next })
          : await post({ action: "review", ...base, decision: next, note: reviewNote.trim() || null });
    setMessage(result.ok ? "保存しました。画面を再読込して最新状態を確認してください。" : result.message || "処理できませんでした。");
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setMessage("画像をアップロードしています…");
    const result = await fetch(`/api/dashboard/managed-shops/${managedShopId}/asset/`, { method: "POST", headers: { "X-ESKOMI-CSRF": "managed-shop-write" }, body: new FormData(form) });
    const body = await result.json() as { ok?: boolean; assetId?: string; message?: string };
    const role = String(new FormData(form).get("asset_role") ?? "banner");
    if (result.ok && body.ok && body.assetId) {
      if (role === "gallery") setGalleryAssetIds((current) => current.includes(body.assetId as string) ? current : [...current, body.assetId as string].slice(0, 10));
      else setAssetId(body.assetId);
      setMessage("private画像を下書きへ追加しました。続けて下書きを保存してください。");
    } else setMessage(body.message || "画像を追加できませんでした。");
  }
  return <section className={styles.formPanel}><p className={styles.eyebrow}>運営編集</p><h2>店舗情報の下書き・審査・公開</h2><p className={styles.note}>公開中の情報は、承認または公開状態の変更まで維持されます。削除は行わず、非公開に切り替えます。</p><ShopForm initial={initial} bannerAssetId={assetId} galleryAssetIds={galleryAssetIds} onSubmit={(event) => { event.preventDefault(); void action("save", event.currentTarget); }} submitLabel="下書きを保存する" message={message} />
    <form className={styles.form} onSubmit={upload}><label>画像の用途<select name="asset_role" defaultValue="banner"><option value="banner">バナー</option><option value="gallery">ギャラリー</option></select></label><label>バナー・ギャラリー画像<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button type="submit">画像をprivate保存する</button></form>
    {galleryAssetIds.length ? <div className={styles.saveGate}><p>ギャラリー画像 {galleryAssetIds.length} / 10</p>{galleryAssetIds.map((id, index) => <p key={id}>画像 {index + 1} <button type="button" onClick={() => setGalleryAssetIds((current) => current.filter((asset) => asset !== id))}>下書きから外す</button></p>)}</div> : null}
    <div className={styles.saveGate}><button type="button" onClick={() => void action("submit")}>審査へ提出する</button><button type="button" onClick={() => void action("approved")}>承認して公開する</button><button type="button" onClick={() => void action("changes_requested")}>差し戻す（理由必須）</button><button type="button" onClick={() => void action(publicationState === "published" ? "unlisted" : "published")}>{publicationState === "published" ? "公開を停止する" : "公開する"}</button><label>差し戻し理由<input name="review_note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label></div>
  </section>;
}

function ShopForm({ initial = {}, onSubmit, submitLabel, message, includeSlug = false, bannerAssetId, galleryAssetIds }: { initial?: Payload; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel: string; message: string; includeSlug?: boolean; bannerAssetId?: string; galleryAssetIds?: readonly string[] }) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {includeSlug ? (
        <label>
          URL slug
          <input name="slug" required defaultValue={String(initial.slug ?? "")} pattern="[a-z0-9][a-z0-9-]{1,118}[a-z0-9]" />
        </label>
      ) : null}
      {fields.map(([name, label]) => (
        <label key={name}>
          {label}
          {name === "introduction" ? (
            <textarea name={name} defaultValue={String(initial[name] ?? "")} />
          ) : (
            <input name={name} type={name.endsWith("url") ? "url" : name.includes("price") ? "number" : "text"} defaultValue={String(initial[name] ?? "")} />
          )}
        </label>
      ))}
      <input name="banner_asset_id" type="hidden" value={bannerAssetId ?? String(initial.banner_asset_id ?? "")} readOnly />
      <input name="gallery_asset_ids" type="hidden" value={(galleryAssetIds ?? (Array.isArray(initial.gallery_asset_ids) ? initial.gallery_asset_ids : [])).join(",")} readOnly />
      <button type="submit">{submitLabel}</button>
      {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
    </form>
  );
}
