import { NextRequest, NextResponse } from "next/server";

import { PARTNER_LOGIN_STATE_HANDOFF_COOKIE } from "@/lib/partner/partner-auth-cookies";
import { partnerAuthRedirectOrigin } from "@/lib/partner/partner-auth-server";
import { PARTNER_LOGIN_STATE_COOKIE, PARTNER_SESSION_COOKIE, authorizePartnerLoginCompletion } from "@/lib/partner/partner-session";
import { secretsMatch } from "@/lib/server/secure-secret";

function noStoreJson(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
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

function failedCompletion() {
  return clearLoginState(noStoreJson({ ok: false, message: "ログインリンクを確認できません。" }, 403));
}

function sameOrigin(request: NextRequest, trustedOrigin: string) {
  return request.headers.get("origin") === trustedOrigin;
}

function validValue(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= maximumLength && !/\s/.test(value);
}

export async function POST(request: NextRequest) {
  const trustedOrigin = partnerAuthRedirectOrigin(process.env);
  if (!trustedOrigin || !sameOrigin(request, trustedOrigin)) return failedCompletion();
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > 10_240) return failedCompletion();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failedCompletion();
  }
  const state = body && typeof body === "object" && "state" in body ? body.state : null;
  const accessToken = body && typeof body === "object" && "accessToken" in body ? body.accessToken : null;
  const expectedState = request.cookies.get(PARTNER_LOGIN_STATE_COOKIE)?.value ?? null;
  if (!validValue(state, 128) || !expectedState || !secretsMatch(expectedState, state) || !validValue(accessToken, 8_192)) {
    return failedCompletion();
  }

  const authorization = await authorizePartnerLoginCompletion({ accessToken, state });
  if (authorization.status !== "allowed") return failedCompletion();

  const response = clearLoginState(noStoreJson({ ok: true }, 200));
  response.cookies.set(PARTNER_SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/partner",
    maxAge: 60 * 60,
  });
  return response;
}
