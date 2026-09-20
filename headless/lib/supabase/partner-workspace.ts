import "server-only";

import type { PartnerRegistrationData } from "@/lib/partner/registration-validation";
import {
  PARTNER_REVIEW_CAMPAIGN_CHANNELS,
  PARTNER_WORKSPACE_STATES,
  type PartnerRegistrationReview,
  type PartnerReviewCampaign,
  type PartnerReviewGrowthRepository,
  type PartnerWorkspace,
  type PartnerWorkspaceRepository,
} from "@/lib/partner/provisioning-service";

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

function isWorkspaceState(value: unknown): value is PartnerWorkspace["state"] {
  return typeof value === "string" && PARTNER_WORKSPACE_STATES.includes(value as PartnerWorkspace["state"]);
}

function isCampaignChannel(value: unknown): value is PartnerReviewCampaign["channel"] {
  return typeof value === "string" && PARTNER_REVIEW_CAMPAIGN_CHANNELS.includes(value as PartnerReviewCampaign["channel"]);
}

function parseCampaign(value: unknown): PartnerReviewCampaign | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && isCampaignChannel(row.channel) && typeof row.token === "string"
    && typeof row.isActive === "boolean" && typeof row.createdAt === "string"
    ? { id: row.id, channel: row.channel, token: row.token, isActive: row.isActive, createdAt: row.createdAt }
    : null;
}

function parseReview(value: unknown): PartnerRegistrationReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const campaigns = Array.isArray(row.campaigns) ? row.campaigns.map(parseCampaign) : null;
  const status = row.status;
  const role = row.contact_role;
  if (typeof row.submission_id !== "string" || typeof row.workspace_id !== "string"
    || !["received", "under_review", "approved", "rejected"].includes(String(status))
    || !["owner", "manager", "staff", "authorized_agency"].includes(String(role))
    || typeof row.contact_name !== "string" || typeof row.contact_email !== "string"
    || typeof row.confirmation_details !== "string" || typeof row.source_url !== "string"
    || typeof row.created_at !== "string" || !isWorkspaceState(row.workspace_state)
    || typeof row.wp_shop_id !== "number" || typeof row.shop_slug !== "string"
    || typeof row.shop_name !== "string" || typeof row.canonical_url !== "string"
    || !campaigns || campaigns.some((campaign) => campaign === null)) return null;
  if ((row.reviewed_at !== null && typeof row.reviewed_at !== "string")
    || (row.reviewed_by !== null && typeof row.reviewed_by !== "string")
    || (row.review_reason !== null && typeof row.review_reason !== "string")) return null;
  return {
    submissionId: row.submission_id,
    workspaceId: row.workspace_id,
    status: status as PartnerRegistrationReview["status"],
    contactName: row.contact_name,
    contactRole: role as PartnerRegistrationReview["contactRole"],
    contactEmail: row.contact_email,
    confirmationDetails: row.confirmation_details,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at as string | null,
    reviewedBy: row.reviewed_by as string | null,
    reviewReason: row.review_reason as string | null,
    workspaceState: row.workspace_state,
    shop: { id: row.wp_shop_id, slug: row.shop_slug, title: row.shop_name, canonicalUrl: row.canonical_url },
    campaigns: campaigns as PartnerReviewCampaign[],
  };
}

export const partnerReviewGrowthRepository: PartnerReviewGrowthRepository = {
  async listRegistrationReviews() {
    const baseUrl = supabaseUrl();
    const headers = serviceHeaders();
    if (!baseUrl || !headers) return [];
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/list_partner_registration_reviews`, {
        method: "POST",
        headers,
        body: "{}",
        cache: "no-store",
      });
      const rows = await response.json() as unknown;
      return response.ok && Array.isArray(rows) ? rows.map(parseReview).filter((row): row is PartnerRegistrationReview => row !== null) : [];
    } catch {
      return [];
    }
  },
  async reviewRegistration(input) {
    const baseUrl = supabaseUrl();
    const headers = serviceHeaders();
    if (!baseUrl || !headers) return null;
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/review_partner_registration`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_submission_id: input.submissionId,
          p_decision: input.decision,
          p_actor_label: input.actorLabel,
          p_reason: input.reason,
        }),
        cache: "no-store",
      });
      const rows = await response.json() as Array<{ state?: unknown; status?: unknown }>;
      const row = response.ok && Array.isArray(rows) ? rows[0] : null;
      return row && isWorkspaceState(row.state) && (row.status === "approved" || row.status === "rejected")
        ? { state: row.state, status: row.status }
        : null;
    } catch {
      return null;
    }
  },
  async openReviewCampaign(token) {
    const baseUrl = supabaseUrl();
    const headers = serviceHeaders();
    if (!baseUrl || !headers) return null;
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/open_partner_review_campaign`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_token: token }),
        cache: "no-store",
      });
      const rows = await response.json() as Array<Record<string, unknown>>;
      const row = response.ok && Array.isArray(rows) ? rows[0] : null;
      return row && typeof row.wp_shop_id === "number" && typeof row.shop_slug === "string"
        && typeof row.shop_name === "string" && typeof row.canonical_url === "string"
        ? { id: row.wp_shop_id, slug: row.shop_slug, title: row.shop_name, canonicalUrl: row.canonical_url }
        : null;
    } catch {
      return null;
    }
  },
  async recordReviewCampaignSubmission(input, signal?: AbortSignal) {
    const baseUrl = supabaseUrl();
    const headers = serviceHeaders();
    if (!baseUrl || !headers) return false;
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/record_partner_review_campaign_submission`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_token: input.token,
          p_wp_shop_id: input.shopId,
          p_wp_review_id: input.wordpressReviewId,
        }),
        cache: "no-store",
        signal,
      });
      const recorded = await response.json() as unknown;
      return response.ok && recorded === true;
    } catch {
      return false;
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
