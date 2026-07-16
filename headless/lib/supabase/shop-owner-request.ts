import type { ShopOwnerRequestData } from "@/lib/shop-owner-request-validation";

type SaveResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "request-failed" };

const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export async function saveShopOwnerRequest(data: ShopOwnerRequestData): Promise<SaveResult> {
  if (
    process.env.SHOP_OWNER_REQUEST_DRY_RUN === "true"
    && process.env.NODE_ENV !== "production"
  ) {
    return { ok: true };
  }

  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { ok: false, reason: "not-configured" };
  }

  const headers: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
    "Content-Profile": "api",
    Prefer: "return=minimal",
  };
  if (LEGACY_SERVICE_ROLE_JWT_RE.test(serviceKey)) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }

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
