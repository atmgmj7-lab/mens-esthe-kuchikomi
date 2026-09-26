import type { ShopOwnerRequestData } from "@/lib/shop-owner-request-validation";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

type SaveResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "request-failed" };

export async function saveShopOwnerRequest(data: ShopOwnerRequestData): Promise<SaveResult> {
  if (
    process.env.SHOP_OWNER_REQUEST_DRY_RUN === "true"
    && process.env.NODE_ENV !== "production"
  ) {
    return { ok: true };
  }

  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serverSecret = resolveSupabaseServerSecret();
  if (!baseUrl || !serverSecret) {
    return { ok: false, reason: "not-configured" };
  }

  const headers = createSupabaseServerHeaders(serverSecret.value, {
    "Content-Type": "application/json",
    "Content-Profile": "api",
    Prefer: "return=minimal",
  });

  try {
    const response = await fetch(`${baseUrl}/rest/v1/shop_owner_requests`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        wp_shop_id: data.shopId,
        shop_slug: data.shopSlug,
        shop_name: data.shopName,
        target_url: data.targetUrl,
        source_url: data.sourceUrl,
        requester_name: data.requesterName,
        requester_role: data.requesterRole,
        requester_email: data.requesterEmail,
        requested_fields: data.requestedFields,
        change_details: data.changeDetails,
        evidence_url: data.evidenceUrl ?? null,
        official_image_url: data.officialImageUrl ?? null,
        consent_privacy: data.consentPrivacy,
        consent_accuracy: data.consentAccuracy,
        consent_image_rights: data.consentImageRights,
      }),
      cache: "no-store",
    });

    return response.ok
      ? { ok: true }
      : { ok: false, reason: "request-failed" };
  } catch {
    return { ok: false, reason: "request-failed" };
  }
}
