"use client";

import { useEffect, useRef } from "react";

function loginError() {
  window.location.replace("/partner/login/?error=invalid-link");
}

export default function PartnerAuthCallbackPage() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const state = url.searchParams.get("state");
    const accessToken = new URLSearchParams(window.location.hash.slice(1)).get("access_token");

    // Never leave the state or the Supabase fragment token in the visible URL.
    window.history.replaceState({}, "", "/partner/auth/callback/");
    if (!state || !accessToken) {
      loginError();
      return;
    }

    void fetch("/api/partner/auth/complete-link/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, accessToken }),
    }).then(async (response) => {
      const body = await response.json().catch(() => null) as { ok?: unknown } | null;
      if (!response.ok || body?.ok !== true) {
        loginError();
        return;
      }
      window.location.replace("/partner/");
    }).catch(loginError);
  }, []);

  return <p role="status">ログインを確認しています…</p>;
}
