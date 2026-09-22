"use client";

import { FormEvent, useState } from "react";

type Props = Readonly<{
  currentEmail: string | null;
  pendingEmail: string | null;
  pendingIntent: string | null;
}>;

export function PartnerLoginEmailSettings({ currentEmail, pendingEmail, pendingIntent }: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/partner/settings/login-email/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => null) as { message?: unknown } | null;
      setMessage(typeof body?.message === "string" ? body.message : "変更を受け付けられませんでした。時間をおいて再度お試しください。");
      if (response.ok) setEmail("");
    } catch {
      setMessage("変更を受け付けられませんでした。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="hl-partner-home__section" aria-labelledby="partner-login-email-heading">
    <p className="hl-partner-home__eyebrow">Account</p>
    <h1 id="partner-login-email-heading">ログインメール</h1>
    <p>ログインに使うメールアドレスを確認・変更できます。店舗情報、口コミ、Campaignは変更されません。</p>
    <dl className="hl-partner-login-email__summary">
      <div><dt>現在のログインメール</dt><dd>{currentEmail ?? "確認できません"}</dd></div>
      <div><dt>変更状況</dt><dd>{pendingEmail ? `${pendingEmail}（確認待ち）` : pendingIntent ? "変更依頼を確認中です" : "変更依頼はありません"}</dd></div>
    </dl>
    <form className="hl-partner-login-email__form" onSubmit={submit}>
      <label htmlFor="partner-login-email">新しいログインメール</label>
      <input id="partner-login-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
      <p>確認が必要な場合は、Supabase Authの既存確認フローに従います。</p>
      <button className="hl-partner-home__primary-action" type="submit" disabled={submitting}>{submitting ? "送信中…" : "変更を依頼する"}</button>
    </form>
    {message ? <p role="status" className="hl-partner-home__unavailable">{message}</p> : null}
  </section>;
}
