"use client";

import { useRef, useState, type FormEvent } from "react";
import { prepareReviewConfirmation, REVIEW_TAGS, type ReviewTag } from "@/lib/reviews/low-friction-review";
import { USED_PERIODS } from "@/lib/review-validation";

type FormStatus = "idle" | "submitting" | "success" | "error";
type AiAssistStatus = "idle" | "loading" | "success" | "error";

const OPTIONAL_RATINGS = [
  { name: "ratingPrice", label: "料金満足度（任意）" },
  { name: "ratingService", label: "接客満足度（任意）" },
  { name: "ratingCleanliness", label: "清潔感（任意）" }
] as const;

const REVIEW_TAG_LABELS: Readonly<Record<ReviewTag, string>> = {
  staff_polite: "接客が丁寧",
  clean: "店内が清潔",
  booking_smooth: "予約がスムーズ",
  price_clear: "料金が分かりやすい",
  beginner_friendly: "初めてでも利用しやすい",
  want_revisit: "また利用したい",
  wait_concern: "待ち時間が気になった",
  price_unclear: "料金が分かりにくかった",
  guidance_unclear: "案内が分かりにくかった",
};

export function ReviewSubmitForm({
  shopSlug,
  shopTitle,
  campaignToken,
}: {
  shopSlug: string;
  shopTitle: string;
  campaignToken?: string;
}) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiStatus, setAiStatus] = useState<AiAssistStatus>("idle");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      shopSlug,
      nickname: String(formData.get("nickname") || ""),
      usedPeriod: String(formData.get("usedPeriod") || ""),
      ratingTotal: Number(formData.get("ratingTotal") || 0),
      ratingPrice: formData.get("ratingPrice") ? Number(formData.get("ratingPrice")) : undefined,
      ratingService: formData.get("ratingService")
        ? Number(formData.get("ratingService"))
        : undefined,
      ratingCleanliness: formData.get("ratingCleanliness")
        ? Number(formData.get("ratingCleanliness"))
        : undefined,
      revisitIntent: String(formData.get("revisitIntent") || ""),
      reviewBody,
      tags,
      website: String(formData.get("website") || ""),
      campaignToken,
    };

    if (!confirming) {
      const confirmation = prepareReviewConfirmation({
        ratingTotal: payload.ratingTotal,
        tags,
        note: payload.reviewBody,
      });
      if (confirmation.status === "needs_note") {
        setStatus("error");
        setErrorMessage("投稿前に、30文字以上の口コミ本文を入力してください。");
        return;
      }
      if (confirmation.status === "invalid") {
        setStatus("error");
        setErrorMessage("評価またはタグを確認してください。");
        return;
      }
      setStatus("idle");
      setConfirming(true);
      return;
    }

    idempotencyKeyRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ESKOMI-CSRF": "review-submit-v1",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setStatus("error");
        setErrorMessage(data.message || "送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      setSuccessMessage(
        data.message ||
          "口コミ投稿ありがとうございます。内容を確認後、掲載いたします。掲載まで数日かかる場合があります。"
      );
      setStatus("success");
      idempotencyKeyRef.current = null;
      setTags([]);
      setConfirming(false);
      setReviewBody("");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。");
    }
  }

  function toggleTag(tag: ReviewTag) {
    setTags((current) => current.includes(tag)
      ? current.filter((value) => value !== tag)
      : current.length < 6 ? [...current, tag] : current);
  }

  async function requestAiAssist() {
    if (aiPending) return;
    const form = document.getElementById("review-submit-form") as HTMLFormElement | null;
    const ratingTotal = Number(new FormData(form ?? undefined).get("ratingTotal") || 0);
    const note = reviewBody.trim();
    setAiDraft(null);
    if (!note) {
      setAiStatus("error");
      setAiMessage("口コミ本文を入力してから、AI添削をお試しください。");
      return;
    }
    if (!Number.isInteger(ratingTotal) || ratingTotal < 1 || ratingTotal > 5) {
      setAiStatus("error");
      setAiMessage("総合評価を選択してから、AI添削をお試しください。");
      return;
    }
    setAiPending(true);
    setAiStatus("loading");
    setAiMessage("");
    try {
      const response = await fetch("/api/reviews/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": "review-submit-v1" },
        body: JSON.stringify({ ratingTotal, tags, note }),
      });
      const data = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as { ok?: boolean; decision?: string; draft?: string; message?: string }
        : null;
      if (!response.ok || !data?.ok) {
        setAiStatus("error");
        setAiMessage(`${data?.message || "AI補助は現在利用できません。"} AIを使わず運営審査へ送れます。`);
        return;
      }
      if (typeof data.draft === "string" && data.draft.trim()) {
        setAiDraft(data.draft.trim());
        setAiMessage("修正案を確認し、採用する場合だけ本文へ反映してください。原文はまだ変更していません。");
      } else {
        setAiMessage(data.decision === "HUMAN_REVIEW"
          ? "この内容は自動添削せず、運営審査で確認します。原文は変更していません。"
          : "AI補助では変更案を作成しませんでした。原文のまま確認へ進めます。");
      }
      setAiStatus("success");
    } catch {
      setAiStatus("error");
      setAiMessage("AI補助の応答を確認できませんでした。もう一度試すか、AIを使わず運営審査へ送れます。");
    } finally {
      setAiPending(false);
    }
  }

  function acceptAiDraft() {
    if (!aiDraft) return;
    setReviewBody(aiDraft);
    setAiDraft(null);
    setAiStatus("success");
    setAiMessage("修正案を本文に反映しました。投稿前に内容をご確認ください。");
  }

  function dismissAiDraft() {
    setAiDraft(null);
    setAiStatus("idle");
    setAiMessage("原文のまま保持しています。必要ならもう一度AI添削をお試しください。");
  }

  if (status === "success") {
    return (
      <div className="hl-contact-success" role="status">
        <p className="hl-contact-success-title">口コミを投稿しました</p>
        <p>{successMessage}</p>
      </div>
    );
  }

  return (
    <form id="review-submit-form" className="hl-contact-form hl-review-form" onSubmit={handleSubmit} noValidate>
      <p className="hl-review-form__shop">
        投稿先店舗：<strong>{shopTitle}</strong>
      </p>

      <div className="hl-contact-honeypot" aria-hidden="true">
        <label htmlFor="review-website">Website</label>
        <input id="review-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="review-nickname">
          ニックネーム <span className="hl-contact-required">必須</span>
        </label>
        <input
          id="review-nickname"
          name="nickname"
          type="text"
          maxLength={30}
          required
          autoComplete="nickname"
        />
      </div>

      <fieldset className="hl-contact-field">
        <legend>印象タグ（任意・最大6件）</legend>
        <div className="hl-review-form__tags">
          {REVIEW_TAGS.map((tag) => <label key={tag}>
            <input
              type="checkbox"
              checked={tags.includes(tag)}
              disabled={!tags.includes(tag) && tags.length >= 6}
              onChange={() => toggleTag(tag)}
            /> {REVIEW_TAG_LABELS[tag]}
          </label>)}
        </div>
      </fieldset>

      <div className="hl-contact-field">
        <label htmlFor="review-used-period">
          利用時期 <span className="hl-contact-required">必須</span>
        </label>
        <select id="review-used-period" name="usedPeriod" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {USED_PERIODS.map((period) => (
            <option key={period} value={period}>
              {period}
            </option>
          ))}
        </select>
      </div>

      <div className="hl-contact-field">
        <label htmlFor="review-rating-total">
          総合評価 <span className="hl-contact-required">必須</span>
        </label>
        <select id="review-rating-total" name="ratingTotal" required defaultValue="">
          <option value="" disabled>
            1〜5を選択
          </option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {OPTIONAL_RATINGS.map(({ name, label }) => (
        <div className="hl-contact-field" key={name}>
          <label htmlFor={`review-${name}`}>{label}</label>
          <select id={`review-${name}`} name={name} defaultValue="">
            <option value="">未入力</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="hl-contact-field">
        <label htmlFor="review-revisit">再訪意向（任意）</label>
        <input id="review-revisit" name="revisitIntent" type="text" maxLength={80} />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="review-body">
          口コミ本文（任意）
        </label>
        <textarea
          id="review-body"
          name="reviewBody"
          rows={8}
          maxLength={1000}
          value={reviewBody}
          onChange={(event) => {
            setReviewBody(event.target.value);
            if (aiDraft) {
              setAiDraft(null);
              setAiStatus("idle");
              setAiMessage("本文を編集したため、先ほどの修正案は破棄しました。");
            }
          }}
        />
        <p className="hl-review-form__hint">確認画面へ進む前に、30〜1000文字の本文が必要です。</p>
      </div>

      <p className="hl-review-form__notice">
        個人情報、誹謗中傷、事実確認が難しい内容、過度な表現は掲載できない場合があります。
      </p>

      {status === "error" && errorMessage ? (
        <p className="hl-contact-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="hl-contact-actions hl-review-form__actions">
        <button
          type="button"
          className="hl-contact-submit hl-review-form__ai-button"
          onClick={requestAiAssist}
          disabled={aiPending}
          aria-busy={aiPending}
          aria-describedby={aiMessage ? "review-ai-feedback" : undefined}
        >
          {aiPending ? "AI確認中..." : "AIで読みやすくして確認"}
        </button>
        <button type="submit" className="hl-contact-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "送信中..." : confirming ? "この内容で口コミを投稿" : "そのまま確認"}
        </button>
      </div>
      {aiMessage ? <p id="review-ai-feedback" className={`hl-review-form__ai-feedback${aiStatus === "error" ? " is-error" : ""}`} role={aiStatus === "error" ? "alert" : "status"} aria-live="polite">{aiMessage}</p> : null}
      {aiDraft ? (
        <section className="hl-review-form__ai-proposal" aria-labelledby="review-ai-proposal-heading">
          <h2 className="hl-review-form__ai-proposal-label" id="review-ai-proposal-heading">AIによる修正案</h2>
          <p className="hl-review-form__ai-proposal-note">原文・評価・タグは変更していません。内容を確認してから反映してください。</p>
          <p className="hl-review-form__ai-proposal-body">{aiDraft}</p>
          <div className="hl-review-form__proposal-actions">
            <button type="button" className="hl-contact-submit" onClick={acceptAiDraft}>修正案を本文に反映</button>
            <button type="button" className="hl-review-form__text-button" onClick={dismissAiDraft}>原文のままにする</button>
          </div>
        </section>
      ) : null}
      {confirming ? <p role="status">内容を確認し、必要なら編集してから「この内容で口コミを投稿」を選択してください。</p> : null}
    </form>
  );
}
