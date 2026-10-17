"use client";

import { useRef, useState, type FormEvent } from "react";

type Draft = Readonly<{
  displayName: string;
  shopRating: number | null;
  commonComment: string;
  therapistRating: number | null;
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
  const [savedInput, setSavedInput] = useState<Draft | null>(null);
  const [status, setStatus] = useState<"input" | "submitting" | "success">("input");
  const [message, setMessage] = useState("");

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const shopRating = rating(data.get("shopRating"));
    const therapistRating = therapistName ? rating(data.get("therapistRating")) : null;
    const displayName = String(data.get("displayName") ?? "").trim();
    const commonComment = String(data.get("commonComment") ?? "").trim();
    if (displayName.length > 30 || commonComment.length > 400 || (!shopRating && !therapistRating && !commonComment)) {
      setMessage("評価またはコメントを一つ以上入力してください。");
      return;
    }
    setMessage("");
    const next = { displayName, shopRating, commonComment, therapistRating };
    setSavedInput(next);
    setDraft(next);
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
      const payload = await response.json() as { ok?: boolean; message?: string; benefitCode?: string | null; benefitStatus?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "送信できませんでした。");
      setMessage(payload.benefitCode
        ? `${payload.message || "口コミを受け付けました。"} 特典コード：${payload.benefitCode}`
        : payload.message || "口コミを受け付けました。");
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
    {draft.displayName ? <p>ニックネーム：{draft.displayName}</p> : null}{draft.shopRating !== null ? <p>店舗評価：{draft.shopRating} / 5</p> : null}{draft.commonComment ? <p>コメント：{draft.commonComment}</p> : null}
    {therapistName && draft.therapistRating !== null ? <p>{therapistName}さんの評価：{draft.therapistRating} / 5</p> : null}
    <p>公開口コミとしてEskomiや店舗HPに掲載される場合があります。特典は評価の高低や公開の可否では変わりません。</p>
    <div className="hl-review-form__actions"><button type="button" onClick={() => setDraft(null)} disabled={status === "submitting"}>戻って修正</button><button type="button" className="hl-contact-submit" onClick={() => void submit()} disabled={status === "submitting"}>{status === "submitting" ? "送信中…" : "受付する"}</button></div>
    {message ? <p role="alert">{message}</p> : null}
  </section>;

  return <form className="hl-contact-form hl-review-form" onSubmit={prepare} noValidate>
    <p className="hl-review-form__shop">投稿先店舗：<strong>{shopName}</strong></p>
    <p>会員登録は不要です。内容は運営確認後に公開されます。</p>
    <label className="hl-contact-field">ニックネーム（任意）<input name="displayName" maxLength={30} defaultValue={savedInput?.displayName ?? ""} /></label>
    <label className="hl-contact-field">店舗の総合評価（任意）<select name="shopRating" defaultValue={savedInput?.shopRating?.toString() ?? ""}><option value="">評価しない</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="hl-contact-field">利用体験コメント（任意）<textarea name="commonComment" rows={7} maxLength={400} defaultValue={savedInput?.commonComment ?? ""} /></label>
    {therapistName ? <fieldset className="hl-contact-field"><legend>{therapistName}さんの評価（任意）</legend><select name="therapistRating" defaultValue={savedInput?.therapistRating?.toString() ?? ""}><option value="">評価しない</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}</select></fieldset> : null}
    <button type="submit" className="hl-contact-submit">内容を確認する</button>{message ? <p role="alert">{message}</p> : null}
  </form>;
}
