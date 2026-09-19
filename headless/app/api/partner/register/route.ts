import { NextRequest, NextResponse } from "next/server";
import { submitPartnerRegistration } from "@/lib/partner/registration-service";
import { validatePartnerRegistrationPayload } from "@/lib/partner/registration-validation";
import { resolveTrustedShopOwnerClientIp, claimShopOwnerRequestRateLimit } from "@/lib/shop-owner-request-rate-limit";
import { partnerWorkspaceRepository, savePartnerRegistration } from "@/lib/supabase/partner-workspace";
import { getShopBySlug } from "@/lib/wp/shops";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "入力内容を確認してください。" }, { status: 400 });
  }
  const validation = validatePartnerRegistrationPayload(body);
  if (!validation.ok) return NextResponse.json({ ok: false, message: validation.error }, { status: 400 });

  const serverSourceUrl = new URL("/partner/register/", request.nextUrl.origin).toString();

  const result = await submitPartnerRegistration(
    { ...validation.data, sourceUrl: serverSourceUrl },
    resolveTrustedShopOwnerClientIp(request.headers),
    {
      getShopBySlug,
      claimRateLimit: claimShopOwnerRequestRateLimit,
      workspaceRepository: partnerWorkspaceRepository,
      saveRegistration: savePartnerRegistration,
    },
  );
  if (!result.ok && result.reason === "shop-mismatch") {
    return NextResponse.json({ ok: false, message: "対象店舗を確認できません。" }, { status: 400 });
  }
  if (!result.ok && result.reason === "rate-limited") {
    return NextResponse.json({ ok: false, message: "送信回数が多すぎます。時間をおいて再度お試しください。" }, { status: 429 });
  }
  if (!result.ok) {
    console.error("[partner-registration] submission failed", { reason: result.reason });
    return NextResponse.json({ ok: false, message: "現在申請を受け付けできません。時間をおいて再度お試しください。" }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    message: "申請を受け付けました。内容は運営確認後にご連絡します。自動公開は行いません。",
  });
}
