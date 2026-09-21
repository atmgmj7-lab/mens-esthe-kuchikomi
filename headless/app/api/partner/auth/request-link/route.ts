import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

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

  const state = randomBytes(32).toString("base64url");
  const redirectTo = new URL("/partner/auth/callback/", trustedOrigin);
  redirectTo.searchParams.set("state", state);
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
  }
  return response;
}
