import { NextRequest, NextResponse } from "next/server";
import { createListingApplicationUploadCapability } from "@/lib/listing-application-upload-token";
import { validateListingApplication } from "@/lib/listing-application-validation";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret, supabaseRpcUrl } from "@/lib/supabase/server-secret";

export async function POST(request: NextRequest) {
  let raw: unknown; try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, message: "入力内容を確認してください。" }, { status: 400 }); }
  const checked = validateListingApplication(raw); if (!checked.ok) return NextResponse.json({ ok: false, message: checked.error }, { status: 400 });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return NextResponse.json({ ok: false, message: "現在申請を受け付けできません。" }, { status: 503 });
  const payload = { idempotency_key: checked.data.idempotencyKey, kind: checked.data.kind, existing_wp_shop_id: checked.data.existingWpShopId ?? null, existing_shop_slug: checked.data.existingShopSlug ?? null, shop_name: checked.data.shopName, area: checked.data.area, website_url: checked.data.websiteUrl, introduction: checked.data.introduction ?? null, contact_name: checked.data.contactName, contact_email: checked.data.contactEmail, contact_role: checked.data.contactRole, edit_preference: checked.data.editPreference, consent_privacy: true, consent_accuracy: true, consent_image_rights: true };
  const response = await fetch(supabaseRpcUrl(base, "submit_listing_application"), { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }), body: JSON.stringify({ p_payload: payload }), cache: "no-store" });
  const applicationId = response.ok ? await response.json() as unknown : null;
  if (typeof applicationId !== "string" || !/^[0-9a-f-]{36}$/i.test(applicationId)) {
    console.error("listing application submit RPC failed", { status: response.status });
    return NextResponse.json({ ok: false, message: "現在申請を受け付けできません。" }, { status: 503 });
  }
  const capability = createListingApplicationUploadCapability();
  const capabilityResponse = await fetch(supabaseRpcUrl(base, "issue_listing_application_upload_token"), {
    method: "POST",
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }),
    body: JSON.stringify({ p_application_id: applicationId, p_token_hash: capability.tokenHash, p_object_id: capability.objectId, p_expires_at: capability.expiresAt }),
    cache: "no-store",
  });
  if (!capabilityResponse.ok) {
    console.error("listing application upload capability RPC failed", { status: capabilityResponse.status });
    return NextResponse.json({ ok: false, message: "現在申請を受け付けできません。" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, applicationId, uploadToken: capability.token, message: "申請を受け付けました。公開前に運営が確認します。" });
}
