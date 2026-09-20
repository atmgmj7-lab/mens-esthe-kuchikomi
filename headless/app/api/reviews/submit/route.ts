import { NextRequest, NextResponse } from "next/server";

import {
  REVIEW_RATE_LIMIT_MAX_REQUESTS,
  REVIEW_SUBMISSION_CSRF_VALUE,
  REVIEW_SUBMISSION_MAX_BODY_BYTES,
  buildReviewAbuseKeyHash,
  buildReviewIdempotencyKeyHash,
  getReviewRateLimitWindow,
  normalizeReviewIdempotencyKey,
  resolveTrustedReviewClientIp,
  utf8ByteLength,
} from "@/lib/reviews/submission-security";
import { reviewNativeRepository } from "@/lib/supabase/review-native";
import { validateReviewPayload } from "@/lib/review-validation";
import { getShopBySlug } from "@/lib/wp/shops";
import { SITE_URL } from "@/lib/seo";

function json(body: { ok: boolean; message: string }, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function parseRequestOrigin(request: NextRequest): URL | null {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
    ?.split(",")[0]?.trim().toLowerCase();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")
    ?.split(",")[0]?.trim().toLowerCase();
  if (!origin || !host) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    if (parsed.host.toLowerCase() !== host) return null;
    if (forwardedProtocol && parsed.protocol !== `${forwardedProtocol}:`) return null;
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return json({ ok: false, message: "JSON形式で送信してください。" }, 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0
      || declaredLength > REVIEW_SUBMISSION_MAX_BODY_BYTES) {
      return json({ ok: false, message: "送信内容が大きすぎます。" }, 413);
    }
  }

  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    return json({ ok: false, message: "送信元を確認できません。" }, 403);
  }
  const requestOrigin = parseRequestOrigin(request);
  if (!requestOrigin) {
    return json({ ok: false, message: "送信元を確認できません。" }, 403);
  }
  if (request.headers.get("x-eskomi-csrf") !== REVIEW_SUBMISSION_CSRF_VALUE) {
    return json({ ok: false, message: "送信情報を確認できません。" }, 403);
  }

  const idempotencyKey = normalizeReviewIdempotencyKey(
    request.headers.get("idempotency-key"),
  );
  if (!idempotencyKey) {
    return json({ ok: false, message: "送信識別子が正しくありません。" }, 400);
  }

  const clientIp = resolveTrustedReviewClientIp(request.headers);
  if (!clientIp) {
    return json({ ok: false, message: "現在口コミを受け付けできません。" }, 503);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ ok: false, message: "リクエスト形式が正しくありません。" }, 400);
  }
  if (utf8ByteLength(rawBody) > REVIEW_SUBMISSION_MAX_BODY_BYTES) {
    return json({ ok: false, message: "送信内容が大きすぎます。" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, message: "リクエスト形式が正しくありません。" }, 400);
  }

  const validation = validateReviewPayload(body);
  if (!validation.ok) {
    return json({ ok: false, message: validation.error }, 400);
  }

  const shop = await getShopBySlug(validation.data.shopSlug);
  if (!shop || shop.publicationStatus !== "publish") {
    return json({ ok: false, message: "指定された店舗が見つかりません。" }, 404);
  }

  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serverSecret) {
    return json({ ok: false, message: "現在口コミを受け付けできません。" }, 503);
  }
  const idempotencyKeyHash = buildReviewIdempotencyKeyHash(idempotencyKey);
  const abuseKeyHash = buildReviewAbuseKeyHash({ clientIp, shopId: shop.id, secret: serverSecret });
  const rateWindow = getReviewRateLimitWindow();
  const claim = await reviewNativeRepository.claimRateLimit({
    idempotencyKeyHash,
    abuseKeyHash,
    windowStartedAt: rateWindow.startedAt,
    windowExpiresAt: rateWindow.expiresAt,
    limit: REVIEW_RATE_LIMIT_MAX_REQUESTS,
  });
  if (claim.status !== "ok") {
    return json({ ok: false, message: "現在口コミを受け付けできません。" }, 503);
  }
  if (!claim.data.allowed) {
    return json(
      { ok: false, message: `送信回数が多すぎます。${claim.data.retryAfterSeconds}秒後に再度お試しください。` },
      429,
      { "Retry-After": String(claim.data.retryAfterSeconds) },
    );
  }

  const result = await reviewNativeRepository.submit({
    shop: { wpShopId: shop.id },
    body: validation.data.reviewBody,
    rating: validation.data.ratingTotal,
    ratingPrice: validation.data.ratingPrice ?? null,
    ratingService: validation.data.ratingService ?? null,
    ratingCleanliness: validation.data.ratingCleanliness ?? null,
    visitPeriod: validation.data.usedPeriod,
    revisitIntent: validation.data.revisitIntent ?? null,
    nickname: validation.data.nickname,
    email: null,
    sourceUrl: new URL("/reviews/submit/", SITE_URL).toString(),
    idempotencyKeyHash,
    abuseKeyHash,
    abuseWindowStartedAt: rateWindow.startedAt,
    abuseWindowExpiresAt: rateWindow.expiresAt,
    campaignToken: validation.data.campaignToken ?? null,
  });
  if (result.status !== "ok") {
    return json({ ok: false, message: "現在口コミを受け付けできません。時間をおいて再度お試しください。" }, 503);
  }

  return json({
    ok: true,
    message: "口コミ投稿ありがとうございます。内容を確認後、掲載いたします。掲載まで数日かかる場合があります。",
  }, 200);
}
