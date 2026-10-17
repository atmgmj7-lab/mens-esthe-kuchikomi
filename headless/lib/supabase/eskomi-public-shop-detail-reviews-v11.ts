import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/;

export type EskomiPublicShopDetailReviewV11 = Readonly<{
  id: string;
  rating: number | null;
  body: string;
  displayName: string | null;
  therapistDisplayName: string | null;
  publishedAt: string;
  reply: Readonly<{ body: string; publishedAt: string | null }> | null;
}>;

export type EskomiPublicShopDetailReviewSummaryV11 = Readonly<{
  reviewCount: number;
  ratingCount: number;
  averageRating: number | null;
  oldestPublishedAt: string | null;
  latestPublishedAt: string | null;
}>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function rating(value: unknown): number | null | undefined {
  return value === null ? null : Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5 ? value as number : undefined;
}

function optionalText(value: unknown, maximum: number): string | null | undefined {
  return value === null ? null : typeof value === "string" && value.length <= maximum ? value : undefined;
}

function parseReview(value: unknown): EskomiPublicShopDetailReviewV11 | null {
  if (!record(value) || !UUID.test(String(value.public_handle ?? "")) || rating(value.rating) === undefined
    || typeof value.body !== "string" || value.body.length > 400
    || optionalText(value.display_name, 30) === undefined || optionalText(value.therapist_display_name, 120) === undefined
    || !timestamp(value.published_at) || optionalText(value.reply_body, 2000) === undefined
    || !(value.reply_published_at === null || timestamp(value.reply_published_at))) return null;
  const replyBody = value.reply_body as string | null;
  const replyAt = value.reply_published_at as string | null;
  if ((replyBody === null) !== (replyAt === null)) return null;
  return {
    id: value.public_handle as string,
    rating: rating(value.rating) as number | null,
    body: value.body,
    displayName: value.display_name as string | null,
    therapistDisplayName: value.therapist_display_name as string | null,
    publishedAt: value.published_at as string,
    reply: replyBody === null ? null : { body: replyBody, publishedAt: replyAt },
  };
}

function parseSummary(value: unknown): EskomiPublicShopDetailReviewSummaryV11 | null {
  if (!record(value) || !Number.isSafeInteger(value.review_count) || (value.review_count as number) < 0
    || !Number.isSafeInteger(value.rating_count) || (value.rating_count as number) < 0
    || (value.rating_count as number) > (value.review_count as number)
    || !(value.average_rating === null || typeof value.average_rating === "number" && Number.isFinite(value.average_rating) && value.average_rating >= 1 && value.average_rating <= 5)
    || !(value.oldest_published_at === null || timestamp(value.oldest_published_at))
    || !(value.latest_published_at === null || timestamp(value.latest_published_at))) return null;
  const count = value.review_count as number;
  if ((count === 0) !== (value.oldest_published_at === null && value.latest_published_at === null)
    || ((value.rating_count as number) === 0) !== (value.average_rating === null)) return null;
  return {
    reviewCount: count,
    ratingCount: value.rating_count as number,
    averageRating: value.average_rating as number | null,
    oldestPublishedAt: value.oldest_published_at as string | null,
    latestPublishedAt: value.latest_published_at as string | null,
  };
}

async function rpc(name: string, values: Record<string, unknown>): Promise<unknown | null> {
  const secret = resolveSupabaseServerSecret()?.value;
  const origin = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!secret || !origin) return null;
  try {
    const parsed = new URL(origin);
    const endpoint = ["127.0.0.1", "localhost"].includes(parsed.hostname) ? `${origin}/rpc/${name}` : `${origin}/rest/v1/rpc/${name}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: createSupabaseServerHeaders(secret, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
      body: JSON.stringify(values),
      cache: "no-store",
    });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

export async function getPublicShopDetailReviewsV11(shopSlug: string, limit: number, offset: number): Promise<Readonly<{
  reviews: readonly EskomiPublicShopDetailReviewV11[];
  summary: EskomiPublicShopDetailReviewSummaryV11;
}> | null> {
  if (!SLUG.test(shopSlug) || !Number.isSafeInteger(limit) || limit < 1 || limit > 20 || !Number.isSafeInteger(offset) || offset < 0) return null;
  const [reviewsValue, summaryValue] = await Promise.all([
    rpc("list_public_shop_detail_reviews_v11", { p_shop_slug: shopSlug, p_limit: limit, p_offset: offset }),
    rpc("get_public_shop_detail_review_summary_v11", { p_shop_slug: shopSlug }),
  ]);
  if (!Array.isArray(reviewsValue) || !Array.isArray(summaryValue) || summaryValue.length !== 1) return null;
  const reviews = reviewsValue.map(parseReview);
  const summary = parseSummary(summaryValue[0]);
  if (!summary || !reviews.every((review): review is EskomiPublicShopDetailReviewV11 => review !== null)
    || reviews.length > Math.min(limit, Math.max(0, summary.reviewCount - offset))) return null;
  return { reviews, summary };
}
