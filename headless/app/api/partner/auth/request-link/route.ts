import { NextRequest, NextResponse } from "next/server";

import { PARTNER_LOGIN_STATE_HANDOFF_COOKIE } from "@/lib/partner/partner-auth-cookies";
import { createPartnerLoginState } from "@/lib/partner/partner-auth-login-state";
import { createPartnerMagicLinkClient, partnerAuthRedirectOrigin } from "@/lib/partner/partner-auth-server";
import { PARTNER_LOGIN_STATE_COOKIE } from "@/lib/partner/partner-session";

function noStoreJson(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

function sameOrigin(request: NextRequest, trustedOrigin: string) {
  return request.headers.get("origin") === trustedOrigin;
}

function clearLoginState(response: NextResponse) {
  response.cookies.set(PARTNER_LOGIN_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/partner/auth/complete-link",
    maxAge: 0,
  });
  response.cookies.set(PARTNER_LOGIN_STATE_HANDOFF_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/partner/auth/callback/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const trustedOrigin = partnerAuthRedirectOrigin(process.env);
  if (!trustedOrigin) return noStoreJson({ ok: false, message: "現在ログインを開始できません。" }, 503);
  if (!sameOrigin(request, trustedOrigin)) return noStoreJson({ ok: false, message: "リクエストを確認できません。" }, 403);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > 2048) {
    return noStoreJson({ ok: false, message: "入力内容を確認してください。" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ ok: false, message: "入力内容を確認してください。" }, 400);
  }
  const email = body && typeof body === "object" && "email" in body && typeof body.email === "string"
    ? body.email.trim()
    : null;
  const client = createPartnerMagicLinkClient(process.env);
  if (!client || !email) return noStoreJson({ ok: false, message: "現在ログインを開始できません。" }, 503);

  const state = createPartnerLoginState(email, process.env);
  if (!state) return noStoreJson({ ok: false, message: "現在ログインを開始できません。" }, 503);
  const redirectTo = new URL("/partner/auth/callback/", trustedOrigin);
  const requested = await client.request(email, redirectTo.toString());
  const response = noStoreJson({ ok: true, message: "登録済みのメールアドレスの場合、ログイン用リンクを送信しました。" }, 202);
  if (requested) {
    response.cookies.set(PARTNER_LOGIN_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/partner/auth/complete-link",
      maxAge: 10 * 60,
    });
    response.cookies.set(PARTNER_LOGIN_STATE_HANDOFF_COOKIE, state, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/partner/auth/callback/",
      maxAge: 10 * 60,
    });
  } else {
    clearLoginState(response);
  }
  return response;
}
