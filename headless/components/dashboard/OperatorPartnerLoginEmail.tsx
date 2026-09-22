"use client";

import { FormEvent, useState } from "react";
import styles from "./OperatorShops.module.css";

type Props = Readonly<{
  shopId: number;
  hasActiveMembership: boolean;
  initial: Readonly<{
    status: "available" | "not_set" | "unavailable" | "identity_mismatch" | "forbidden";
    email: string | null;
    intent: string | null;
  }>;
}>;

function intentLabel(intent: string | null): string {
  if (intent === "operator_initial") return "初期設定";
  if (intent === "operator_change_requested") return "Operatorからの変更依頼";
  if (intent === "partner_change_requested") return "店舗からの変更依頼";
  return "未設定";
}

export function OperatorPartnerLoginEmail({ shopId, hasActiveMembership, initial }: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const action = hasActiveMembership ? "operator_change_requested" : "operator_initial";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/dashboard/shops/${shopId}/login-email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      const body = await response.json().catch(() => null) as { message?: unknown } | null;
      setMessage(typeof body?.message === "string" ? body.message : "保存できませんでした。時間をおいて再度お試しください。");
      if (response.ok) setEmail("");
    } catch {
      setMessage("保存できませんでした。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  const unavailable = initial.status === "unavailable" || initial.status === "identity_mismatch";
  return <section className={styles.panel} aria-labelledby="operator-login-email-heading">
    <h3 id="operator-login-email-heading">ログインメール</h3>
    <p>ログイン先の初期設定または変更依頼だけを記録します。ここからAuthユーザー、Membership、Workspaceは変更しません。</p>
    <dl className={styles.detailList}>
      <div><dt>設定メール</dt><dd>{initial.email ?? "未設定"}</dd></div>
      <div><dt>状態</dt><dd>{unavailable ? "canonical照合またはサービスを確認してください" : intentLabel(initial.intent)}</dd></div>
    </dl>
    {!unavailable ? <form className={styles.form} onSubmit={submit}>
      <label htmlFor="operator-login-email">ログインメール<input id="operator-login-email" type="email" autoComplete="off" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button type="submit" disabled={submitting}>{submitting ? "記録中…" : hasActiveMembership ? "変更依頼を記録する" : "初期メールを記録する"}</button>
    </form> : null}
    {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
  </section>;
}
