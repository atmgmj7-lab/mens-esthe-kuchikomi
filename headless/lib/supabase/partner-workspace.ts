import "server-only";

import type { PartnerRegistrationData } from "@/lib/partner/registration-validation";
import type { PartnerWorkspace, PartnerWorkspaceRepository } from "@/lib/partner/provisioning-service";

const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function serviceHeaders(): Record<string, string> | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const headers: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
    "Content-Profile": "api",
    "Accept-Profile": "api",
  };
  if (LEGACY_SERVICE_ROLE_JWT_RE.test(serviceKey)) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}

function supabaseUrl(): string | null {
  return process.env.SUPABASE_URL?.replace(/\/$/, "") || null;
}

export const partnerWorkspaceRepository: PartnerWorkspaceRepository = {
  async provision(input) {
    const baseUrl = supabaseUrl();
    const headers = serviceHeaders();
    if (!baseUrl || !headers) return null;
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/provision_partner_workspace`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_wp_shop_id: input.shopId,
          p_shop_slug: input.shopSlug,
          p_shop_name: input.shopName,
          p_canonical_url: input.canonicalUrl,
          p_source: input.source,
        }),
        cache: "no-store",
      });
      const rows = await response.json() as Array<{ workspace_id?: string; state?: PartnerWorkspace["state"]; initialized?: boolean }>;
      const row = response.ok && Array.isArray(rows) ? rows[0] : null;
      return row?.workspace_id && row.state
        ? { id: row.workspace_id, state: row.state, initialized: row.initialized === true }
        : null;
    } catch {
      return null;
    }
  },
};

export async function savePartnerRegistration(input: {
  workspaceId: string;
  data: PartnerRegistrationData;
}): Promise<{ ok: true; state: PartnerWorkspace["state"] } | { ok: false }> {
  const baseUrl = supabaseUrl();
  const headers = serviceHeaders();
  if (!baseUrl || !headers) return { ok: false };
  try {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/register_partner_submission`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_workspace_id: input.workspaceId,
        p_contact_name: input.data.contactName,
        p_contact_role: input.data.contactRole,
        p_contact_email: input.data.contactEmail,
        p_confirmation_details: input.data.confirmationDetails,
        p_source_url: input.data.sourceUrl,
        p_consent_terms: input.data.consentTerms,
      }),
      cache: "no-store",
    });
    const state = await response.json() as PartnerWorkspace["state"];
    return response.ok && typeof state === "string" ? { ok: true, state } : { ok: false };
  } catch {
    return { ok: false };
  }
}
