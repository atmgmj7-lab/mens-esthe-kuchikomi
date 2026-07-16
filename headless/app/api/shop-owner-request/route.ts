import { NextRequest, NextResponse } from "next/server";
import {
  claimShopOwnerRequestRateLimit,
  resolveTrustedShopOwnerClientIp,
} from "@/lib/shop-owner-request-rate-limit";
import { submitCanonicalShopOwnerRequest } from "@/lib/shop-owner-request-service";
import { validateShopOwnerRequestPayload } from "@/lib/shop-owner-request-validation";
import { saveShopOwnerRequest } from "@/lib/supabase/shop-owner-request";
import { getShopBySlug } from "@/lib/wp/shops";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "入力内容を確認してください。" },
      { status: 400 },
    );
  }

  const validation = validateShopOwnerRequestPayload(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, message: validation.error },
      { status: 400 },
    );
  }

  const result = await submitCanonicalShopOwnerRequest(
    validation.data,
    { clientIp: resolveTrustedShopOwnerClientIp(request.headers) },
    {
      getShopBySlug,
      claimRateLimit: claimShopOwnerRequestRateLimit,
      save: saveShopOwnerRequest,
    },
  );
  if (!result.ok && result.reason === "shop-mismatch") {
    return NextResponse.json(
      { ok: false, message: "対象店舗の情報を確認してください。" },
      { status: 400 },
    );
  }
  if (!result.ok && result.reason === "rate-limited") {
    return NextResponse.json(
      {
        ok: false,
        message: `送信回数が多すぎます。${result.retryAfterSec}秒後に再度お試しください。`,
      },
      { status: 429 },
    );
  }
  if (!result.ok) {
    console.error("[shop-owner-request] submission failed", { reason: result.reason });
    return NextResponse.json(
      {
        ok: false,
        message: "現在申請を受け付けできません。時間をおいて再度お試しください。",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, message: "申請を受け付けました。" });
}
