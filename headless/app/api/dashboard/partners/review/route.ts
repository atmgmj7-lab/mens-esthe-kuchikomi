import { NextRequest, NextResponse } from "next/server";

import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { reviewPartnerRegistration } from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";

function authorizationFailure(status: 401 | 503): NextResponse {
  return NextResponse.json(
    { ok: false, message: status === 503 ? "管理画面の認証設定を確認してください。" : "管理画面の認証が必要です。" },
    {
      status,
      headers: {
        ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Dashboard"' } : {}),
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

function invalidRequest(message: string, status: 400 | 409): NextResponse {
  return NextResponse.json({ ok: false, message }, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function POST(request: NextRequest) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return authorizationFailure(authorization.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("判断内容を確認してください。", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest("判断内容を確認してください。", 400);
  }

  const decisionBody = body as { submissionId?: unknown; decision?: unknown; reason?: unknown };

  if (typeof decisionBody.submissionId !== "string" || !decisionBody.submissionId
    || (decisionBody.decision !== "approved" && decisionBody.decision !== "rejected")
    || typeof decisionBody.reason !== "string" || !decisionBody.reason.trim()) {
    return invalidRequest("判断内容を確認してください。", 400);
  }

  const result = await reviewPartnerRegistration({
    submissionId: decisionBody.submissionId,
    decision: decisionBody.decision,
    actorLabel: "dashboard_operator",
    reason: decisionBody.reason,
  }, partnerReviewGrowthRepository);
  if (!result) {
    return invalidRequest("判断を保存できませんでした。状態を確認して再度お試しください。", 409);
  }

  return NextResponse.json({ ok: true, review: result }, {
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
