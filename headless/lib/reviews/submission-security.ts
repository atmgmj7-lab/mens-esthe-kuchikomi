import "server-only";

import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

export const REVIEW_SUBMISSION_MAX_BODY_BYTES = 16_384;
export const REVIEW_SUBMISSION_CSRF_VALUE = "review-submit-v1";
export const REVIEW_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const REVIEW_RATE_LIMIT_MAX_REQUESTS = 3;

const IDEMPOTENCY_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type HeaderReader = Pick<Headers, "get">;

function firstValidIp(value: string | null): string | null {
  if (!value) return null;
  for (const candidate of value.split(",")) {
    const normalized = candidate.trim();
    if (isIP(normalized)) return normalized;
  }
  return null;
}

export function resolveTrustedReviewClientIp(headers: HeaderReader): string | null {
  if (process.env.VERCEL === "1") {
    return firstValidIp(headers.get("x-vercel-forwarded-for"));
  }
  for (const name of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const ip = firstValidIp(headers.get(name));
    if (ip) return ip;
  }
  return null;
}

export function normalizeReviewIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return IDEMPOTENCY_KEY_RE.test(normalized) ? normalized : null;
}

export function buildReviewIdempotencyKeyHash(idempotencyKey: string): string {
  return createHash("sha256").update(`review-submit-v1|${idempotencyKey}`).digest("hex");
}

export function buildReviewAbuseKeyHash({
  clientIp,
  shopId,
  secret,
}: {
  clientIp: string;
  shopId: number;
  secret: string;
}): string {
  return createHmac("sha256", secret)
    .update(`review-submit-v1|ip:${clientIp}|shop:${shopId}`)
    .digest("hex");
}

export function getReviewRateLimitWindow(now = new Date()): Readonly<{
  startedAt: string;
  expiresAt: string;
}> {
  const startedAtMs = Math.floor(now.getTime() / REVIEW_RATE_LIMIT_WINDOW_MS)
    * REVIEW_RATE_LIMIT_WINDOW_MS;
  return {
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: new Date(startedAtMs + REVIEW_RATE_LIMIT_WINDOW_MS).toISOString(),
  };
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
