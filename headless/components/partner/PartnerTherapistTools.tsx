"use client";

import { FormEvent, useEffect, useState } from "react";

import { PartnerCopyButton } from "@/components/partner/PartnerCopyButton";
const PARTNER_MUTATION_CSRF = "partner-mutation-v1";

type Therapist = { assignment_id: string; display_name: string; photo_asset_id: string; lifecycle_state: "active" | "retired"; revision: number; permission_policy_version: string };
type Preview = { subject: string | null; body: string; review_url: string; therapist_display_name: string | null };
const RIGHTS_POLICY = "therapist-photo-rights-v1";

async function responseJson(response: Response) {
  const value = await response.json().catch(() => null) as { message?: unknown } | null;
  return { ok: response.ok, value, message: typeof value?.message === "string" ? value.message : "処理できませんでした。" };
}
export function PartnerTherapistTools() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoAssetId, setPhotoAssetId] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const refresh = async () => {
    setLoading(true);
    const result = await responseJson(await fetch("/api/partner/therapists", { cache: "no-store" }));
    if (result.ok && Array.isArray((result.value as { therapists?: unknown }).therapists)) setTherapists((result.value as { therapists: Therapist[] }).therapists);
    else setNotice(result.message);
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, []);

  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    setNotice("写真を確認してアップロードしています…");
    const form = new FormData(); form.set("photo", file);
    const result = await responseJson(await fetch("/api/partner/therapists/photo", { method: "POST", headers: { "X-ESKOMI-CSRF": PARTNER_MUTATION_CSRF }, body: form }));
    const assetId = (result.value as { assetId?: unknown } | null)?.assetId;
    if (result.ok && typeof assetId === "string") { setPhotoAssetId(assetId); setNotice("写真を登録しました。公開名と権利確認をして担当者を保存してください。"); }
    else setNotice(result.message);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault(); setNotice(null);
    if (!photoAssetId || !rights) { setNotice("写真を登録し、掲載・利用権利を確認してください。"); return; }
    const result = await responseJson(await fetch("/api/partner/therapists", { method: "POST", headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": PARTNER_MUTATION_CSRF }, body: JSON.stringify({ displayName, photoAssetId, permissionPolicyVersion: RIGHTS_POLICY, permissionConfirmed: true }) }));
    if (!result.ok) { setNotice(result.message); return; }
    setDisplayName(""); setPhotoAssetId(null); setRights(false); setNotice("担当者を登録しました。"); await refresh();
  };

  const updateName = async (therapist: Therapist, value: string) => {
    const result = await responseJson(await fetch("/api/partner/therapists", { method: "PATCH", headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": PARTNER_MUTATION_CSRF }, body: JSON.stringify({ assignmentId: therapist.assignment_id, revision: therapist.revision, displayName: value, photoAssetId: therapist.photo_asset_id, permissionPolicyVersion: therapist.permission_policy_version, permissionConfirmed: true }) }));
    setNotice(result.ok ? "公開名を更新しました。" : result.message); if (result.ok) await refresh();
  };

  const end = async (therapist: Therapist) => {
    if (!window.confirm(`${therapist.display_name}さんを退店として扱います。既存の投稿リンクは店舗のみの投稿へ切り替わります。`)) return;
    const result = await responseJson(await fetch("/api/partner/therapists", { method: "DELETE", headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": PARTNER_MUTATION_CSRF }, body: JSON.stringify({ assignmentId: therapist.assignment_id, revision: therapist.revision }) }));
    setNotice(result.ok ? "退店として保存しました。以後の案内文は店舗のみの投稿になります。" : result.message); if (result.ok) await refresh();
  };

  const makePreview = async (therapistAssignmentId: string | null, channel: "line" | "email") => {
    const result = await responseJson(await fetch("/api/partner/review-request/preview", { method: "POST", headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": PARTNER_MUTATION_CSRF }, body: JSON.stringify({ therapistAssignmentId, channel, greetingVariant: "recent" }) }));
    if (result.ok && (result.value as { preview?: Preview }).preview) { setPreview((result.value as { preview: Preview }).preview); setNotice("コピー用の案内文を作成しました。ここから自動送信はされません。"); }
    else setNotice(result.message);
  };

  return <section className="hl-partner-home__section" aria-labelledby="partner-therapists-heading">
    <div className="hl-partner-home__section-heading"><div><p className="hl-partner-home__eyebrow">THERAPISTS</p><h2 id="partner-therapists-heading">担当者と個別の口コミリンク</h2></div></div>
    <p>公開名・写真と利用権利を記録して、担当者を任意で選べる口コミリンクを作れます。評価はお客様の任意で、ここからLINEやメールを自動送信することはありません。</p>
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={create} className="hl-partner-home__action">
      <label>公開名<input value={displayName} maxLength={40} required onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>写真<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPhoto(event.target.files?.[0] ?? null)} /></label>
      <p>{photoAssetId ? "写真を登録済みです。" : "写真を選ぶと、公開前に安全に登録します。"}</p>
      <label><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} /> 本人から公開名・写真の掲載と利用について確認を得ました。</label>
      <button type="submit" disabled={!photoAssetId || !rights}>担当者を登録</button>
    </form>
    <div className="hl-partner-home__collection">
      <section className="hl-partner-home__asset"><h3>店舗のみのご案内</h3><p>担当者を選ばない口コミ投稿用の、コピー専用の案内文です。</p><button type="button" onClick={() => void makePreview(null, "line")}>店舗のみの案内文を作成</button></section>
      {loading ? <p>担当者を読み込んでいます…</p> : therapists.map((therapist) => <TherapistCard key={therapist.assignment_id} therapist={therapist} onUpdate={updateName} onEnd={end} onPreview={makePreview} />)}
    </div>
    {preview && <section className="hl-partner-home__asset" aria-live="polite"><h3>{preview.therapist_display_name ? `${preview.therapist_display_name}さん向け` : "店舗のみ"}のコピー用案内文</h3>{preview.subject && <><p>件名: {preview.subject}</p><PartnerCopyButton label="件名" value={preview.subject} /></>}<textarea readOnly value={preview.body} rows={10} aria-label="コピー用の案内文" /><p>{preview.review_url}</p><div className="hl-partner-growth-center__asset-actions"><PartnerCopyButton label="口コミリンク" value={preview.review_url} /><PartnerCopyButton label="案内文" value={preview.body} /></div></section>}
  </section>;
}

function TherapistCard({ therapist, onUpdate, onEnd, onPreview }: { therapist: Therapist; onUpdate: (therapist: Therapist, name: string) => Promise<void>; onEnd: (therapist: Therapist) => Promise<void>; onPreview: (id: string | null, channel: "line" | "email") => Promise<void> }) {
  const [name, setName] = useState(therapist.display_name);
  const [rights, setRights] = useState(false);
  return <section className="hl-partner-home__asset"><h3>{therapist.display_name}</h3>{therapist.lifecycle_state === "active" ? <><label>公開名<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} /></label><label><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} /> この変更後も公開名・写真の掲載と利用権利を確認しました。</label><div className="hl-partner-growth-center__asset-actions"><button type="button" disabled={!rights} onClick={() => void onUpdate(therapist, name)}>公開名を保存</button><button type="button" onClick={() => void onPreview(therapist.assignment_id, "line")}>LINE用文面を作成</button><button type="button" onClick={() => void onPreview(therapist.assignment_id, "email")}>メール用文面を作成</button><button type="button" onClick={() => void onEnd(therapist)}>退店として保存</button></div></> : <p>退店済みです。既存の担当者リンクは店舗のみの投稿として継続します。</p>}</section>;
}
