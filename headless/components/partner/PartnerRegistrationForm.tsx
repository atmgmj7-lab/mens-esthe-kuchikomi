"use client";

import { useState, type FormEvent } from "react";
import { PARTNER_CONTACT_ROLES } from "@/lib/partner/registration-validation";

type ShopOption = { id: number; slug: string; title: string };
type Status = "idle" | "submitting" | "success" | "error";

export function PartnerRegistrationForm({ shops }: { shops: ShopOption[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/partner/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: String(data.get("shopSlug") || ""),
          contactName: String(data.get("contactName") || ""),
          contactRole: String(data.get("contactRole") || ""),
          contactEmail: String(data.get("contactEmail") || ""),
          confirmationDetails: String(data.get("confirmationDetails") || ""),
          sourceUrl: window.location.href,
          consentTerms: data.get("consentTerms") === "on",
          website: String(data.get("website") || ""),
        }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "送信に失敗しました。");
      setStatus("success");
      setMessage(payload.message || "申請を受け付けました。");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "送信に失敗しました。");
    }
  }

  if (status === "success") return <div className="hl-contact-success" role="status"><p className="hl-contact-success-title">申請を受け付けました</p><p>{message}</p></div>;

  return (
    <form className="hl-contact-form hl-partner-form" onSubmit={submit} noValidate>
      <div className="hl-contact-honeypot" aria-hidden="true"><label htmlFor="partner-website">Website</label><input id="partner-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="hl-contact-field"><label htmlFor="partner-shop">対象店舗 <span className="hl-contact-required">必須</span></label><select id="partner-shop" name="shopSlug" required defaultValue=""><option value="" disabled>Eskomi掲載店舗を選択してください</option>{shops.map((shop) => <option key={shop.id} value={shop.slug}>{shop.title}</option>)}</select></div>
      <div className="hl-contact-field"><label htmlFor="partner-name">お名前・ご担当者名 <span className="hl-contact-required">必須</span></label><input id="partner-name" name="contactName" required maxLength={80} autoComplete="name" /></div>
      <div className="hl-contact-field"><label htmlFor="partner-role">店舗との関係 <span className="hl-contact-required">必須</span></label><select id="partner-role" name="contactRole" required defaultValue=""><option value="" disabled>選択してください</option>{PARTNER_CONTACT_ROLES.map((role) => <option value={role} key={role}>{role === "owner" ? "オーナー" : role === "manager" ? "店舗責任者" : role === "staff" ? "店舗スタッフ" : "正規代理担当者"}</option>)}</select></div>
      <div className="hl-contact-field"><label htmlFor="partner-email">確認用メールアドレス <span className="hl-contact-required">必須</span></label><input id="partner-email" name="contactEmail" type="email" required maxLength={254} autoComplete="email" /></div>
      <div className="hl-contact-field"><label htmlFor="partner-confirmation">確認情報 <span className="hl-contact-required">必須</span></label><textarea id="partner-confirmation" name="confirmationDetails" rows={5} maxLength={2000} required placeholder="店舗との関係と、運営から確認できる連絡先・公式URLなどを入力してください。" /></div>
      <div className="hl-contact-consent"><label><input type="checkbox" name="consentTerms" required /><span>利用条件と個人情報の取り扱いに同意します。<span className="hl-contact-required"> 必須</span></span></label></div>
      {status === "error" ? <p className="hl-contact-error" role="alert">{message}</p> : null}
      <div className="hl-contact-actions"><button type="submit" className="hl-contact-submit" disabled={status === "submitting"}>{status === "submitting" ? "送信中…" : "無料公式パートナーを申請"}</button></div>
    </form>
  );
}
