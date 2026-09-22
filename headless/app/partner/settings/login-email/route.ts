import { NextRequest, NextResponse } from "next/server";

import { normalizePartnerLoginEmail } from "@/lib/partner/partner-login-email";
import { createPartnerAuthenticatedEmailClient } from "@/lib/partner/partner-login-email-server";
import { recordPartnerLoginEmailChangeRequest } from "@/lib/partner/partner-login-email-service";
import { partnerAuthRedirectOrigin } from "@/lib/partner/partner-auth-server";
import { PARTNER_SESSION_COOKIE, authorizePartnerLoginEmailSession } from "@/lib/partner/partner-session";

function response(message: string, status: number) {
  return NextResponse.json({ ok: status < 400, message }, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function POST(request: NextRequest) {
  const trustedOrigin = partnerAuthRedirectOrigin(process.env);
  if (!trustedOrigin || request.headers.get("origin") !== trustedOrigin) return response("リクエストを確認できません。", 403);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > 2_048) return response("入力内容を確認してください。", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return response("入力内容を確認してください。", 400); }
  const email = normalizePartnerLoginEmail(body && typeof body === "object" && "email" in body ? body.email : null);
  if (!email) return response("メールアドレスを確認してください。", 400);

  const accessToken = request.cookies.get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const session = await authorizePartnerLoginEmailSession({ accessToken });
  if (session.status === "unauthenticated") return response("ログインを確認してください。", 401);
  if (session.status !== "allowed" || !accessToken) return response("この店舗の設定を変更できません。", 403);

  const client = createPartnerAuthenticatedEmailClient(process.env);
  const requested = client ? await client.requestEmailChange(accessToken, email) : null;
  if (!requested) return response("変更を受け付けられませんでした。時間をおいて再度お試しください。", 503);
  const recorded = await recordPartnerLoginEmailChangeRequest(session.access.workspaceId, session.authUser.id, requested);
  if (recorded.status !== "available") return response("変更確認の状態を保存できませんでした。ログインメールを確認してから、時間をおいて再度お試しください。", 503);
  return response("変更を受け付けました。必要な場合はメールの確認を完了してください。", 202);
}
