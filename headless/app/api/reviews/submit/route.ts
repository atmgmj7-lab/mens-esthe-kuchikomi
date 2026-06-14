import { NextRequest, NextResponse } from "next/server";
import { checkReviewRateLimit } from "@/lib/review-rate-limit";
import { validateReviewPayload } from "@/lib/review-validation";
import { submitReviewToWordPress } from "@/lib/wp/review-submit";
import { getShopBySlug } from "@/lib/wp/shops";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
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

  const result = await submitReviewToWordPress({
    ...validation.data,
    shopId: shop.id,
    shopTitle: shop.title
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "口コミ投稿ありがとうございます。内容を確認後、掲載いたします。掲載まで数日かかる場合があります。"
  });
}
