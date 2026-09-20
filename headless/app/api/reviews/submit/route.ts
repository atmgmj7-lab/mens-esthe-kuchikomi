import { NextRequest, NextResponse } from "next/server";
import { checkReviewRateLimit } from "@/lib/review-rate-limit";
import { validateReviewPayload } from "@/lib/review-validation";
import {
  openPartnerReviewCampaign,
  recordPartnerReviewCampaignSubmission,
} from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { submitReviewToWordPress } from "@/lib/wp/review-submit";
import { getShopBySlug } from "@/lib/wp/shops";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function campaignTokenFrom(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const token = (body as Record<string, unknown>).campaignToken;
  return typeof token === "string" && token.length <= 200 ? token.trim() : "";
}

const PARTNER_REVIEW_CONVERSION_TIMEOUT_MS = 750;

async function recordPartnerReviewCampaignSubmissionWithinDeadline(input: {
  token: string;
  shopId: number;
  wordpressReviewId: number;
}): Promise<void> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve();
    }, PARTNER_REVIEW_CONVERSION_TIMEOUT_MS);
  });
  try {
    await Promise.race([
      recordPartnerReviewCampaignSubmission(input, partnerReviewGrowthRepository, controller.signal).then(() => undefined, () => undefined),
      deadline,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkReviewRateLimit(ip);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `送信回数が多すぎます。${rate.retryAfterSec}秒後に再度お試しください。`
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエスト形式が正しくありません。" },
      { status: 400 }
    );
  }

  const validation = validateReviewPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, message: validation.error }, { status: 400 });
  }

  const shop = await getShopBySlug(validation.data.shopSlug);
  if (!shop) {
    return NextResponse.json(
      { ok: false, message: "指定された店舗が見つかりません。" },
      { status: 404 }
    );
  }

  const campaignToken = campaignTokenFrom(body);
  const campaign = campaignToken
    ? await openPartnerReviewCampaign(campaignToken, partnerReviewGrowthRepository)
    : null;
  if (campaign && campaign.id !== shop.id) {
    return NextResponse.json(
      { ok: false, message: "キャンペーンの投稿先店舗を確認できません。" },
      { status: 400 },
    );
  }

  const result = await submitReviewToWordPress({
    ...validation.data,
    shopId: shop.id,
    shopTitle: shop.title
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 503 });
  }

  const wordpressReviewId = result.id;
  if (campaign && result.ok && typeof wordpressReviewId === "number" && Number.isSafeInteger(wordpressReviewId) && wordpressReviewId > 0) {
    await recordPartnerReviewCampaignSubmissionWithinDeadline({ token: campaignToken, shopId: shop.id, wordpressReviewId });
  }

  return NextResponse.json({
    ok: true,
    message:
      "口コミ投稿ありがとうございます。内容を確認後、掲載いたします。掲載まで数日かかる場合があります。"
  });
}
