"use client";

import { useEffect, useRef } from "react";

import { PARTNER_LOGIN_STATE_HANDOFF_COOKIE } from "@/lib/partner/partner-auth-cookies";

function loginError() {
  window.location.replace("/partner/login/?error=invalid-link");
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

function clearHandoffCookie() {
  document.cookie = `${encodeURIComponent(PARTNER_LOGIN_STATE_HANDOFF_COOKIE)}=; Path=/partner/auth/callback/; Max-Age=0; SameSite=Lax`;
}

export default function PartnerAuthCallbackPage() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const state = readCookie(PARTNER_LOGIN_STATE_HANDOFF_COOKIE);
    const accessToken = new URLSearchParams(window.location.hash.slice(1)).get("access_token");

    // Never leave the state or the Supabase fragment token in the visible URL.
    window.history.replaceState({}, "", "/partner/auth/callback/");

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
    }).catch(() => {
      clearHandoffCookie();
      loginError();
    });
  }, []);

  return <p role="status">ログインを確認しています…</p>;
}
