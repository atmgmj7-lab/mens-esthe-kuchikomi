import { NextRequest, NextResponse } from "next/server";

import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { reviewNativeRepository } from "@/lib/supabase/review-native";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const REVIEW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function authorizationFailure(status: 401 | 503) {
  return NextResponse.json(
    { ok: false, message: status === 503 ? "管理画面の認証設定を確認してください。" : "管理画面の認証が必要です。" },
    {
      status,
      headers: {
        ...RESPONSE_HEADERS,
        ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Dashboard"' } : {}),
      },
    },
  );
}

function fail(message: string, status: 400 | 403 | 404 | 409 | 503) {
  return NextResponse.json({ ok: false, message }, { status, headers: RESPONSE_HEADERS });
}

function authorized(request: NextRequest) {
  return authorizeDashboardRequest(request.headers.get("authorization"), process.env);
}

export async function GET(request: NextRequest) {
  const authorization = authorized(request);
  if (!authorization.ok) return authorizationFailure(authorization.status);

  const reviewId = request.nextUrl.searchParams.get("reviewId");
  if (!reviewId) {
    const queue = await reviewNativeRepository.listModerationQueue({ limit: 50, offset: 0 });
    if (queue.status === "error") return fail("口コミ一覧を取得できませんでした。", 503);
    return NextResponse.json(
      { ok: true, reviews: queue.status === "ok" ? queue.data : [] },
      { headers: RESPONSE_HEADERS },
    );
  }
  if (!REVIEW_ID_RE.test(reviewId)) return fail("口コミIDを確認してください。", 400);

  const [detail, audit] = await Promise.all([
    reviewNativeRepository.getModerationDetail(reviewId),
    reviewNativeRepository.listModerationAudit(reviewId),
  ]);
  if (detail.status === "no_data") return fail("口コミが見つかりません。", 404);
  if (detail.status !== "ok" || audit.status === "error") {
    return fail("口コミ詳細を取得できませんでした。", 503);
  }
  return NextResponse.json({
    ok: true,
    review: detail.data,
    audit: audit.status === "ok" ? audit.data : [],
  }, { headers: RESPONSE_HEADERS });
}

export async function POST(request: NextRequest) {
  const authorization = authorized(request);
  if (!authorization.ok) return authorizationFailure(authorization.status);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json"
    || request.headers.get("sec-fetch-site") !== "same-origin"
    || request.headers.get("x-eskomi-csrf") !== "review-moderation"
    || request.headers.get("origin") !== request.nextUrl.origin) {
    return fail("この操作は受け付けられません。", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("判断内容を確認してください。", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("判断内容を確認してください。", 400);
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["reviewId", "action", "reason"].includes(key))
    || typeof input.reviewId !== "string" || !REVIEW_ID_RE.test(input.reviewId)
    || !["approved", "rejected", "spam", "published"].includes(String(input.action))
    || typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 1000) {
    return fail("判断内容を確認してください。", 400);
  }

  const actorLabel = "dashboard_review_operator";
  const result = input.action === "published"
    ? await reviewNativeRepository.publish({
      reviewId: input.reviewId,
      actorLabel,
      reason: input.reason.trim(),
    })
    : await reviewNativeRepository.moderate({
      reviewId: input.reviewId,
      decision: input.action as "approved" | "rejected" | "spam",
      actorLabel,
      reason: input.reason.trim(),
    });
  if (result.status !== "ok") {
    return fail("判断を保存できませんでした。状態を確認して再度お試しください。", 409);
  }

  return NextResponse.json({ ok: true, review: result.data }, { headers: RESPONSE_HEADERS });
}
