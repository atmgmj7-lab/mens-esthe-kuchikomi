"use client";

import { useState, type FormEvent } from "react";
import { gaEvent } from "@/lib/gtag";
import { CONTACT_TYPES } from "@/lib/contact-validation";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      type: String(formData.get("type") || ""),
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      shopName: String(formData.get("shopName") || ""),
      targetUrl: String(formData.get("targetUrl") || ""),
      message: String(formData.get("message") || ""),
      consent: formData.get("consent") === "on",
      website: String(formData.get("website") || ""),
      sourceUrl: typeof window !== "undefined" ? window.location.href : ""
    };

    try {
      const res = await fetch("/api/contact/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await res.json()) as { ok?: boolean; message?: string };

      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMessage(data.message || "送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      setStatus("success");
      form.reset();
      gaEvent("contact_form_submit", {
        contact_type: payload.type,
        page_path: "/contact/"
      });
    } catch {
      setStatus("error");
      setErrorMessage("通信エラーが発生しました。時間をおいて再度お試しください。");
    }
  }

  if (status === "success") {
    return (
      <div className="hl-contact-success" role="status">
        <p className="hl-contact-success-title">送信が完了しました</p>
        <p>
          お問い合わせありがとうございます。内容を確認のうえ、ご連絡いたします。
          <br />
          通常2〜3営業日以内にご返信いたします。
        </p>
      </div>
    );
  }

  return (
    <form className="hl-contact-form" onSubmit={handleSubmit} noValidate>
      <div className="hl-contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="contact-type">
          お問い合わせ種別 <span className="hl-contact-required">必須</span>
        </label>
        <select id="contact-type" name="type" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {CONTACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="hl-contact-field">
        <label htmlFor="contact-name">
          お名前 <span className="hl-contact-required">必須</span>
        </label>
        <input id="contact-name" name="name" type="text" required maxLength={80} autoComplete="name" />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="contact-email">
          メールアドレス <span className="hl-contact-required">必須</span>
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="contact-shop">店舗名（任意）</label>
        <input id="contact-shop" name="shopName" type="text" maxLength={120} />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="contact-url">対象URL（任意）</label>
        <input
          id="contact-url"
          name="targetUrl"
          type="url"
          maxLength={500}
          placeholder="https://mens-esthe-kuchikomi.com/shops/..."
        />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="contact-message">
          お問い合わせ内容 <span className="hl-contact-required">必須</span>
        </label>
        <textarea id="contact-message" name="message" required rows={6} maxLength={5000} />
      </div>

      <div className="hl-contact-consent">
        <label>
          <input type="checkbox" name="consent" required />
          <span>
            入力いただいた個人情報は、お問い合わせへの対応のみに利用します。
            <span className="hl-contact-required"> 必須</span>
          </span>
        </label>
      </div>

      {status === "error" && errorMessage ? (
        <p className="hl-contact-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="hl-contact-actions">
        <button type="submit" className="hl-contact-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "送信中…" : "送信する"}
        </button>
      </div>
    </form>
  );
}
