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
    event.preventDefault(); setMessage("店舗を公開しています…");
    const form = event.currentTarget; const slug = String(new FormData(form).get("slug") ?? "").trim();
    const result = await post({ action: "create_and_publish", slug, payload: value(form) });
    if (result.ok && result.managedShopId) { window.location.assign(`/dashboard/shops/managed/${result.managedShopId}/`); return; }
    setMessage(result.message || "新規店舗を公開できませんでした。");
  }
  return <section className={styles.formPanel}><p className={styles.eyebrow}>新規店舗</p><h2>店舗を追加して公開</h2><p className={styles.note}>運営が追加した店舗は、保存と同時に公開します。既存の公開・掲載停止操作は履歴として残り、物理削除は行いません。</p><ShopForm onSubmit={submit} submitLabel="保存して公開する" message={message} includeSlug /></section>;
}

export function ManageLegacyShopButton({ wpShopId }: { wpShopId: number }) {
  const [message, setMessage] = useState("");
  async function start() {
    setMessage("既存情報を読み込み、Web管理へ移しています…");
    const result = await post({ action: "import_and_publish", wpShopId });
    if (result.ok && result.managedShopId) { window.location.assign(`/dashboard/shops/managed/${result.managedShopId}/`); return; }
    setMessage(result.message || "Web管理を開始できませんでした。");
  }
  return <div className={styles.saveGate}><button type="button" onClick={start}>Web管理で編集する</button>{message ? <p role="status">{message}</p> : null}</div>;
}

export function UnlistLegacyShopButton({ wpShopId, shopName }: { wpShopId: number; shopName: string }) {
  return <UnlistShopForm shopName={shopName} body={{ wpShopId }} />;
}

export function ManagedShopEditorForm({ managedShopId, revision, initial, publicationState }: { managedShopId: string; revision: number; initial: Payload; publicationState: "published" | "unlisted" }) {
  const [message, setMessage] = useState(""); const [assetId, setAssetId] = useState(typeof initial.banner_asset_id === "string" ? initial.banner_asset_id : ""); const [galleryAssetIds, setGalleryAssetIds] = useState(Array.isArray(initial.gallery_asset_ids) ? initial.gallery_asset_ids.filter((id): id is string => typeof id === "string" && UUID.test(id)) : []);
  const shopName = typeof initial.shop_name === "string" ? initial.shop_name : "";
  async function action(next: "save_and_publish" | "restore", form?: HTMLFormElement) {
    if (next === "save_and_publish" && !form) return; setMessage("処理しています…");
    const base = { managedShopId, expectedRevision: revision };
    const result = next === "save_and_publish" ? await post({ action: "save_and_publish", ...base, payload: { ...value(form as HTMLFormElement), banner_asset_id: assetId || null, gallery_asset_ids: galleryAssetIds } })
      : await post({ action: "restore", ...base });
    setMessage(result.ok ? (next === "restore" ? "再掲載しました。画面を再読込して最新状態を確認してください。" : "保存して公開しました。画面を再読込して最新状態を確認してください。") : result.message || "処理できませんでした。");
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setMessage("画像をアップロードしています…");
    const result = await fetch(`/api/dashboard/managed-shops/${managedShopId}/asset/`, { method: "POST", headers: { "X-ESKOMI-CSRF": "managed-shop-write" }, body: new FormData(form) });
    const body = await result.json() as { ok?: boolean; assetId?: string; message?: string };
    const role = String(new FormData(form).get("asset_role") ?? "banner");
    if (result.ok && body.ok && body.assetId) {
      if (role === "gallery") setGalleryAssetIds((current) => current.includes(body.assetId as string) ? current : [...current, body.assetId as string].slice(0, 10));
      else setAssetId(body.assetId);
      setMessage("private画像を追加しました。続けて保存して公開してください。");
    } else setMessage(body.message || "画像を追加できませんでした。");
  }
  return <section className={styles.formPanel}><p className={styles.eyebrow}>運営編集</p><h2>店舗情報を編集して公開</h2><p className={styles.note}>運営の保存はすぐ公開されます。削除は行わず、掲載停止に切り替えるため、ID・slug・口コミ・改訂履歴を保持したまま再掲載できます。</p><ShopForm initial={initial} bannerAssetId={assetId} galleryAssetIds={galleryAssetIds} onSubmit={(event) => { event.preventDefault(); void action("save_and_publish", event.currentTarget); }} submitLabel="保存して公開する" message={message} />
    <form className={styles.form} onSubmit={upload}><label>画像の用途<select name="asset_role" defaultValue="banner"><option value="banner">バナー</option><option value="gallery">ギャラリー</option></select></label><label>バナー・ギャラリー画像<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button type="submit">画像をprivate保存する</button></form>
    {galleryAssetIds.length ? <div className={styles.saveGate}><p>ギャラリー画像 {galleryAssetIds.length} / 10</p>{galleryAssetIds.map((id, index) => <p key={id}>画像 {index + 1} <button type="button" onClick={() => setGalleryAssetIds((current) => current.filter((asset) => asset !== id))}>下書きから外す</button></p>)}</div> : null}
    {publicationState === "published" ? <UnlistShopForm shopName={shopName} body={{ managedShopId }} /> : <div className={styles.saveGate}><p>この店舗は掲載停止中です。店舗情報・口コミ・URLは保持したまま再掲載できます。</p><button type="button" onClick={() => void action("restore")}>再掲載する</button></div>}
  </section>;
}

function UnlistShopForm({ shopName, body }: { shopName: string; body: Record<string, unknown> }) {
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("掲載を停止しています…");
    const result = await post({ action: "unlist", ...body, confirmedShopName: confirmation });
    if (result.ok && result.managedShopId) { window.location.assign(`/dashboard/shops/managed/${result.managedShopId}/`); return; }
    setMessage(result.message || "掲載を停止できませんでした。");
  }
  return <form className={styles.saveGate} onSubmit={submit}><p><strong>掲載を停止する</strong><br />公開一覧・エリア・検索・サイトマップ・詳細ページから外します。店舗ID・slug・口コミ・改訂履歴・private画像は削除されず、あとで再掲載できます。</p><label>確認のため「{shopName}」を店舗名を正確に入力<input aria-label="掲載停止する店舗名" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label><button type="submit" disabled={confirmation !== shopName}>「{shopName}」を掲載停止する</button>{message ? <p role="status">{message}</p> : null}</form>;
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
