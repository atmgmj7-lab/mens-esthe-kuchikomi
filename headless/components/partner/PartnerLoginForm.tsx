"use client";

import { useState } from "react";

export function PartnerLoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partner/auth/request-link/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { message?: unknown };
      setMessage(typeof result.message === "string" ? result.message : "現在ログインを開始できません。");
    } catch {
      setMessage("現在ログインを開始できません。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="hl-contact-form">
      <label htmlFor="partner-login-email">メールアドレス</label>
      <input
        id="partner-login-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit" className="hl-contact-submit" disabled={pending}>
        {pending ? "送信しています…" : "ログイン用リンクを送信"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
