import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  REVIEW_SUBMISSION_MAX_BODY_BYTES,
  normalizeReviewIdempotencyKey,
  resolveTrustedReviewClientIp,
  utf8ByteLength,
} from "@/lib/reviews/submission-security";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";
import { eskomiReviewV2Repository } from "@/lib/supabase/eskomi-review-v2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CSRF_VALUE = "review-entry-v2";

type EntrySubmission = {
  entryHandle: string;
  displayName: string;
  shopRating: number;
  shopBody: string;
  therapistRating: number | null;
  therapistBody: string | null;
};

function response(ok: boolean, message: string, status: number) {
  return NextResponse.json({ ok, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function validOrigin(request: NextRequest): boolean {
  return request.headers.get("sec-fetch-site") === "same-origin"
    && request.headers.get("origin") === request.nextUrl.origin
    && request.headers.get("x-eskomi-csrf") === CSRF_VALUE;
}

function parseSubmission(value: unknown): EntrySubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => ![
    "entryHandle", "displayName", "shopRating", "shopBody", "therapistRating", "therapistBody",
  ].includes(key))) return null;
  const entryHandle = typeof input.entryHandle === "string" ? input.entryHandle.trim() : "";
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  const shopBody = typeof input.shopBody === "string" ? input.shopBody.trim() : "";
  const therapistRating = input.therapistRating === null
    ? null
    : typeof input.therapistRating === "number" && Number.isInteger(input.therapistRating)
      ? input.therapistRating
      : undefined;
  const therapistBody = input.therapistBody === null
    ? null
    : typeof input.therapistBody === "string"
      ? input.therapistBody.trim()
      : undefined;
  if (!UUID_RE.test(entryHandle) || displayName.length < 1 || displayName.length > 80
    || !Number.isInteger(input.shopRating) || (input.shopRating as number) < 1 || (input.shopRating as number) > 5
    || shopBody.length < 1 || shopBody.length > 4000) return null;
  if (therapistRating === undefined || therapistBody === undefined || (therapistRating === null) !== (therapistBody === null)) return null;
  if (therapistRating !== null && (therapistRating < 1 || therapistRating > 5
    || therapistBody === null || therapistBody.length < 1 || therapistBody.length > 4000)) return null;
  return {
    entryHandle,
    displayName,
    shopRating: input.shopRating as number,
    shopBody,
    therapistRating: therapistRating as number | null,
    therapistBody,
  };
}

export async function POST(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
    || !validOrigin(request)) return response(false, "送信元を確認できません。", 403);
  const idempotencyKey = normalizeReviewIdempotencyKey(request.headers.get("idempotency-key"));
  const secret = resolveSupabaseServerSecret()?.value;
  const clientIp = resolveTrustedReviewClientIp(request.headers);
  if (!idempotencyKey || !secret || !clientIp) return response(false, "現在口コミを受け付けできません。", 503);

  let raw: string;
  try { raw = await request.text(); } catch { return response(false, "リクエスト形式が正しくありません。", 400); }
  if (utf8ByteLength(raw) > REVIEW_SUBMISSION_MAX_BODY_BYTES) return response(false, "送信内容が大きすぎます。", 413);
  let input: EntrySubmission | null;
  try { input = parseSubmission(JSON.parse(raw)); } catch { input = null; }
  if (!input) return response(false, "入力内容を確認してください。", 400);

  const canonicalPayload = JSON.stringify(input);
  const hmac = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const result = await eskomiReviewV2Repository.submit({
    entryHandle: input.entryHandle,
    idempotencyHash: createHash("sha256").update(`review-entry-v2|${idempotencyKey}`).digest("hex"),
    requestFingerprint: createHash("sha256").update(canonicalPayload).digest("hex"),
    displayName: input.displayName,
    editReceiptHash: hmac(`review-entry-v2|receipt|${idempotencyKey}|${input.entryHandle}`),
    deviceFingerprintHash: null,
    ipPrefixHash: hmac(`review-entry-v2|ip|${clientIp}|${input.entryHandle}`),
    shopRating: input.shopRating,
    shopBody: input.shopBody,
    therapistRating: input.therapistRating,
    therapistBody: input.therapistBody,
  });
  if (!result) return response(false, "現在口コミを受け付けできません。時間をおいて再度お試しください。", 503);
  return response(true, result.replayed
    ? "受付済みの口コミです。運営確認後に掲載します。"
    : "口コミを受け付けました。運営確認後に掲載します。", 200);
}
