"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { gaEvent } from "@/lib/gtag";
import type { ShopOwnerRequestInitial } from "@/lib/shop-owner-request-links";
import {
  SHOP_OWNER_REQUEST_FIELDS,
  SHOP_OWNER_REQUEST_ROLES,
} from "@/lib/shop-owner-request-validation";

const FIELD_LABELS = {
  price: "料金",
  hours: "営業時間",
  access: "アクセス",
  reservation: "予約先",
  introduction: "店舗紹介",
  features: "特徴・設備",
  "official-image": "公式画像",
  other: "その他",
} as const;

const ROLE_LABELS = {
  owner: "オーナー",
  manager: "店舗責任者",
  staff: "店舗スタッフ",
  "authorized-agency": "正規代理担当者",
} as const;

type FormStatus = "idle" | "submitting" | "success" | "error";

export function ShopOwnerRequestForm({ initial }: { initial: ShopOwnerRequestInitial }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      shopId: Number(initial.shopId),
      shopSlug: initial.shopSlug,
      shopName: initial.shopName,
      targetUrl: initial.targetUrl,
      sourceUrl: window.location.href,
      requesterName: String(data.get("requesterName") || ""),
      requesterRole: String(data.get("requesterRole") || ""),
      requesterEmail: String(data.get("requesterEmail") || ""),
      requestedFields: data.getAll("requestedFields").map(String),
      changeDetails: String(data.get("changeDetails") || ""),
      evidenceUrl: String(data.get("evidenceUrl") || ""),
      officialImageUrl: String(data.get("officialImageUrl") || ""),
      consentPrivacy: data.get("consentPrivacy") === "on",
      consentAccuracy: data.get("consentAccuracy") === "on",
      consentImageRights: data.get("consentImageRights") === "on",
      website: String(data.get("website") || ""),
    };

    try {
      const response = await fetch("/api/shop-owner-request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "送信に失敗しました。");
      }

      setStatus("success");
      gaEvent("shop_owner_request_submit", { shop_slug: initial.shopSlug, source: initial.source });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "送信に失敗しました。");
    }
  }

  if (!initial.shopId || !initial.shopSlug || !initial.shopName || !initial.targetUrl) {
    return (
      <p className="hl-owner-request-empty" role="status">
        対象店舗を確認できません。店舗詳細ページの「掲載情報を登録・修正」からお進みください。
      </p>
    );
  }

  if (status === "success") {
    return (
      <div className="hl-contact-success" role="status">
        <p className="hl-contact-success-title">申請を受け付けました</p>
        <p>内容を確認後、必要に応じてご連絡します。申請内容は自動公開されません。</p>
      </div>
    );
  }

  return (
    <form className="hl-contact-form hl-owner-request-form" onSubmit={submit} noValidate>
      <div className="hl-contact-honeypot" aria-hidden="true">
        <label htmlFor="owner-request-website">Website</label>
        <input
          id="owner-request-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="hl-owner-request-prefill" aria-label="申請対象の店舗">
        <span>対象店舗</span>
        <strong>{initial.shopName}</strong>
        <small>{initial.targetUrl}</small>
      </div>

      <div className="hl-contact-field">
        <label htmlFor="owner-request-name">
          お名前・ご担当者名 <span className="hl-contact-required">必須</span>
        </label>
        <input id="owner-request-name" name="requesterName" required maxLength={80} autoComplete="name" />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="owner-request-role">
          店舗との関係 <span className="hl-contact-required">必須</span>
        </label>
        <select id="owner-request-role" name="requesterRole" required defaultValue="">
          <option value="" disabled>選択してください</option>
          {SHOP_OWNER_REQUEST_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      </div>

      <div className="hl-contact-field">
        <label htmlFor="owner-request-email">
          確認用メールアドレス <span className="hl-contact-required">必須</span>
        </label>
        <input
          id="owner-request-email"
          name="requesterEmail"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <fieldset className="hl-owner-request-fields">
        <legend>登録・修正したい内容 <span className="hl-contact-required">必須</span></legend>
        {SHOP_OWNER_REQUEST_FIELDS.map((field) => (
          <label key={field}>
            <input type="checkbox" name="requestedFields" value={field} />
            <span>{FIELD_LABELS[field]}</span>
          </label>
        ))}
      </fieldset>

      <div className="hl-contact-field">
        <label htmlFor="owner-request-details">
          変更内容 <span className="hl-contact-required">必須</span>
        </label>
        <textarea id="owner-request-details" name="changeDetails" required rows={7} maxLength={5000} />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="owner-request-evidence">根拠となる公式URL（任意）</label>
        <input id="owner-request-evidence" name="evidenceUrl" type="url" maxLength={500} inputMode="url" />
      </div>

      <div className="hl-contact-field">
        <label htmlFor="owner-request-image">公式画像URL（任意）</label>
        <input id="owner-request-image" name="officialImageUrl" type="url" maxLength={500} inputMode="url" />
        <p className="hl-owner-request-help">画像ファイルの添付は受け付けていません。店舗が掲載権限を持つ公式画像のURLをご入力ください。</p>
      </div>

      <div className="hl-contact-consent">
        <label>
          <input type="checkbox" name="consentPrivacy" required />
          <span>個人情報の取り扱いに同意します。<span className="hl-contact-required"> 必須</span></span>
        </label>
      </div>
      <div className="hl-contact-consent">
        <label>
          <input type="checkbox" name="consentAccuracy" required />
          <span>入力内容が正確であることを確認しました。<span className="hl-contact-required"> 必須</span></span>
        </label>
      </div>
      <div className="hl-contact-consent">
        <label>
          <input type="checkbox" name="consentImageRights" required />
          <span>画像を申請する場合、掲載権限を保有しています。<span className="hl-contact-required"> 必須</span></span>
        </label>
      </div>

      {status === "error" && message ? (
        <div className="hl-owner-request-error">
          <p className="hl-contact-error" role="alert">{message}</p>
          <p><Link href="/contact/">通常のお問い合わせフォームを利用する</Link></p>
        </div>
      ) : null}

      <div className="hl-contact-actions">
        <button type="submit" className="hl-contact-submit" disabled={status === "submitting"}>
          {status === "submitting" ? "送信中…" : "登録・修正内容を送信する"}
        </button>
      </div>
    </form>
  );
}
