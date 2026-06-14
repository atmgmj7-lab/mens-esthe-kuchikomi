"use client";

import { useState, type FormEvent } from "react";
import { USED_PERIODS } from "@/lib/review-validation";

type FormStatus = "idle" | "submitting" | "success" | "error";

const OPTIONAL_RATINGS = [
  { name: "ratingPrice", label: "料金満足度（任意）" },
  { name: "ratingService", label: "接客満足度（任意）" },
  { name: "ratingCleanliness", label: "清潔感（任意）" }
] as const;

export function ReviewSubmitForm({
  shopSlug,
  shopTitle
}: {
  shopSlug: string;
  shopTitle: string;
}) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
      reviewBody: String(formData.get("reviewBody") || ""),
      website: String(formData.get("website") || ""),
      sourceUrl: typeof window !== "undefined" ? window.location.href : ""
    };

    try {
      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      form.reset();
    } catch {
      setStatus("error");
      setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。");
    }
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
    <form className="hl-contact-form hl-review-form" onSubmit={handleSubmit} noValidate>
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
        <input id="review-revisit" name="revisitIntent" type="text" maxLength={200} />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="review-body">
          口コミ本文 <span className="hl-contact-required">必須</span>
        </label>
        <textarea
          id="review-body"
          name="reviewBody"
          rows={8}
          minLength={30}
          maxLength={1000}
          required
        />
        <p className="hl-review-form__hint">30〜1000文字で入力してください。</p>
      </div>

      <p className="hl-review-form__notice">
        個人情報、誹謗中傷、事実確認が難しい内容、過度な表現は掲載できない場合があります。
      </p>

      {status === "error" && errorMessage ? (
        <p className="hl-contact-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="hl-contact-actions">
        <button type="submit" className="hl-contact-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "送信中..." : "口コミを送信する"}
        </button>
      </div>
    </form>
  );
}
