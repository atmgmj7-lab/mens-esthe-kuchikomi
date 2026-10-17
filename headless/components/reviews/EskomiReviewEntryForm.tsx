"use client";

import { useRef, useState, type FormEvent } from "react";

type Draft = Readonly<{
  displayName: string;
  shopRating: number;
  shopBody: string;
  therapistRating: number | null;
  therapistBody: string | null;
}>;

function rating(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^[1-5]$/.test(value)) return null;
  return Number(value);
}

export function EskomiReviewEntryForm({ entryHandle, shopName, therapistName }: {
  entryHandle: string;
  shopName: string;
  therapistName: string | null;
}) {
  const idempotencyKeyRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<"input" | "submitting" | "success">("input");
  const [message, setMessage] = useState("");

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const shopRating = rating(data.get("shopRating"));
    const therapistRating = therapistName ? rating(data.get("therapistRating")) : null;
    const displayName = String(data.get("displayName") ?? "").trim();
    const shopBody = String(data.get("shopBody") ?? "").trim();
    const therapistBody = therapistName ? String(data.get("therapistBody") ?? "").trim() : "";
    if (!displayName || !shopRating || !shopBody || (therapistName && ((therapistRating === null) !== !therapistBody))) {
      setMessage("必須項目と、セラピスト評価の入力組を確認してください。");
      return;
    }
    setMessage("");
    setDraft({ displayName, shopRating, shopBody, therapistRating, therapistBody: therapistBody || null });
  }

  async function submit() {
    if (!draft || status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/reviews/entry-v2/submit/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ESKOMI-CSRF": "review-entry-v2",
          "Idempotency-Key": idempotencyKeyRef.current ?? (idempotencyKeyRef.current = crypto.randomUUID()),
        },
        body: JSON.stringify({ entryHandle, ...draft }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "送信できませんでした。");
      setMessage(payload.message || "口コミを受け付けました。");
      setStatus("success");
    } catch (error) {
      setStatus("input");
      setMessage(error instanceof Error ? error.message : "送信できませんでした。");
    }
  }

  if (status === "success") return <div className="hl-contact-success" role="status"><p className="hl-contact-success-title">受付完了</p><p>{message}</p></div>;
  if (draft) return <section className="hl-contact-section" aria-labelledby="review-entry-confirm-heading">
    <h2 id="review-entry-confirm-heading">入力内容の確認</h2>
    <p>投稿先：<strong>{shopName}</strong></p>
    <p>ニックネーム：{draft.displayName}</p><p>店舗評価：{draft.shopRating} / 5</p><p>本文：{draft.shopBody}</p>
    {therapistName && draft.therapistRating !== null ? <p>{therapistName}さんの評価：{draft.therapistRating} / 5<br />{draft.therapistBody}</p> : null}
    <div className="hl-review-form__actions"><button type="button" onClick={() => setDraft(null)}>戻って修正</button><button type="button" className="hl-contact-submit" onClick={() => void submit()} disabled={status === "submitting"}>{status === "submitting" ? "送信中…" : "受付する"}</button></div>
    {message ? <p role="alert">{message}</p> : null}
  </section>;

  return <form className="hl-contact-form hl-review-form" onSubmit={prepare} noValidate>
    <p className="hl-review-form__shop">投稿先店舗：<strong>{shopName}</strong></p>
    <p>会員登録は不要です。内容は運営確認後に公開されます。</p>
    <label className="hl-contact-field">ニックネーム <span className="hl-contact-required">必須</span><input name="displayName" maxLength={80} required /></label>
    <label className="hl-contact-field">店舗の評価 <span className="hl-contact-required">必須</span><select name="shopRating" defaultValue="" required><option value="" disabled>1〜5を選択</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="hl-contact-field">口コミ本文 <span className="hl-contact-required">必須</span><textarea name="shopBody" rows={7} maxLength={4000} required /></label>
    {therapistName ? <fieldset className="hl-contact-field"><legend>{therapistName}さんの評価（任意）</legend><select name="therapistRating" defaultValue=""><option value="">評価しない</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}</select><textarea name="therapistBody" rows={5} maxLength={4000} placeholder="評価する場合は本文も入力してください" /></fieldset> : null}
    <button type="submit" className="hl-contact-submit">内容を確認する</button>{message ? <p role="alert">{message}</p> : null}
  </form>;
}
