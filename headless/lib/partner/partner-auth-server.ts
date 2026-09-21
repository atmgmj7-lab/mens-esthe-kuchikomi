import "server-only";

import type { PartnerAccessDependencies, PartnerAuthUser, PartnerMembershipAccess } from "@/lib/partner/partner-auth";
import type { PartnerDashboardIdentityDependencies, PartnerWorkspaceIdentity } from "@/lib/partner/partner-dashboard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type Environment = Readonly<Record<string, string | undefined>>;
type AuthConfiguration = Readonly<{ baseUrl: string; authPublishableKey: string }>;

function normalizeSupabaseUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:"
      && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function configuredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseAuthUser(value: unknown): PartnerAuthUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const user = value as Record<string, unknown>;
  return typeof user.id === "string" && UUID_RE.test(user.id)
    && (typeof user.email === "string" || user.email === null || user.email === undefined)
    ? { id: user.id, email: typeof user.email === "string" ? user.email : null }
    : null;
}

function parseMembership(value: unknown): PartnerMembershipAccess | null {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== "object") return null;
  const row = value[0] as Record<string, unknown>;
  return typeof row.workspace_id === "string" && UUID_RE.test(row.workspace_id)
    && typeof row.wp_shop_id === "number" && Number.isSafeInteger(row.wp_shop_id) && row.wp_shop_id > 0
    && typeof row.shop_slug === "string" && row.shop_slug.length > 0
    && (row.role === "owner" || row.role === "manager")
    ? { workspaceId: row.workspace_id, shopId: row.wp_shop_id, shopSlug: row.shop_slug, role: row.role }
    : null;
}

function parseWorkspaceIdentity(value: unknown): PartnerWorkspaceIdentity | null {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== "object") return null;
  const row = value[0] as Record<string, unknown>;
  return typeof row.workspace_id === "string" && UUID_RE.test(row.workspace_id)
    && typeof row.wp_shop_id === "number" && Number.isSafeInteger(row.wp_shop_id) && row.wp_shop_id > 0
    && typeof row.shop_slug === "string" && row.shop_slug.length > 0
    && typeof row.shop_name === "string" && row.shop_name.trim().length > 0
    && typeof row.canonical_url === "string" && row.canonical_url.length > 0
    && (row.state === "free_official_partner" || row.state === "active_partner")
    ? {
      workspaceId: row.workspace_id,
      shopId: row.wp_shop_id,
      shopSlug: row.shop_slug,
      shopName: row.shop_name,
      canonicalUrl: row.canonical_url,
      state: row.state,
    }
    : null;
}

function authConfiguration(environment: Environment): AuthConfiguration | null {
  const baseUrl = normalizeSupabaseUrl(environment.SUPABASE_URL);
  const authPublishableKey = configuredString(environment.SUPABASE_AUTH_PUBLISHABLE_KEY);
  return baseUrl && authPublishableKey ? { baseUrl, authPublishableKey } : null;
}

export function partnerAuthRedirectOrigin(environment: Environment): string | null {
  const configured = configuredString(environment.PARTNER_AUTH_REDIRECT_ORIGIN);
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHttp = url.protocol === "http:"
      && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash
      || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function validMagicLinkToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 1024 && !/\s/.test(value);
}

/**
 * Creates server-only adapters. Browser code never receives this object, the
 * service-role key, or a private-schema endpoint.
 *
 */
export function createPartnerAuthDependencies(
  environment: Environment,
  fetchImpl: typeof fetch = fetch,
): (PartnerAccessDependencies & PartnerDashboardIdentityDependencies) | null {
  const auth = authConfiguration(environment);
  const serviceRoleKey = configuredString(environment.SUPABASE_SERVICE_ROLE_KEY);
  if (!auth || !serviceRoleKey) return null;

  const serviceHeaders: Record<string, string> = {
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
    "Content-Profile": "api",
    "Accept-Profile": "api",
  };
  if (LEGACY_SERVICE_ROLE_JWT_RE.test(serviceRoleKey)) serviceHeaders.Authorization = `Bearer ${serviceRoleKey}`;

  return {
    async getUser(accessToken: string): Promise<PartnerAuthUser | null> {
      if (typeof accessToken !== "string" || !accessToken) return null;
      try {
        const response = await fetchImpl(`${auth.baseUrl}/auth/v1/user`, {
          method: "GET",
          headers: {
            apikey: auth.authPublishableKey,
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });
        return response.ok ? parseAuthUser(await response.json()) : null;
      } catch {
        return null;
      }
    },
    async getActiveMembership(authUserId: string): Promise<PartnerMembershipAccess | null> {
      if (typeof authUserId !== "string" || !UUID_RE.test(authUserId)) return null;
      try {
        const response = await fetchImpl(`${auth.baseUrl}/rest/v1/rpc/get_partner_auth_membership`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify({ p_auth_user_id: authUserId }),
          cache: "no-store",
        });
        return response.ok ? parseMembership(await response.json()) : null;
      } catch {
        return null;
      }
    },
    async getWorkspaceIdentity(workspaceId: string): Promise<PartnerWorkspaceIdentity | null> {
      if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) return null;
      try {
        const response = await fetchImpl(`${auth.baseUrl}/rest/v1/rpc/get_partner_workspace_identity`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify({ p_workspace_id: workspaceId }),
          cache: "no-store",
        });
        return response.ok ? parseWorkspaceIdentity(await response.json()) : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Requests and verifies an email magic link without exposing the Supabase
 * publishable key, token exchange, or access token to client JavaScript.
 *
 */
export function createPartnerMagicLinkClient(environment: Environment, fetchImpl: typeof fetch = fetch) {
  const auth = authConfiguration(environment);
  if (!auth) return null;

  return {
    async request(email: string, redirectTo: string): Promise<boolean> {
      if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        || typeof redirectTo !== "string") return false;
      try {
        const response = await fetchImpl(`${auth.baseUrl}/auth/v1/otp`, {
          method: "POST",
          headers: { apikey: auth.authPublishableKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            create_user: false,
            options: { email_redirect_to: redirectTo },
          }),
          cache: "no-store",
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    async verify(tokenHash: string): Promise<string | null> {
      if (!validMagicLinkToken(tokenHash)) return null;
      try {
        const url = new URL(`${auth.baseUrl}/auth/v1/verify`);
        url.searchParams.set("token_hash", tokenHash);
        url.searchParams.set("type", "email");
        const response = await fetchImpl(url, {
          method: "GET",
          headers: { apikey: auth.authPublishableKey },
          cache: "no-store",
        });
        const body = response.ok ? await response.json() : null;
        return body && typeof body === "object" && typeof body.access_token === "string" && body.access_token
          ? body.access_token
          : null;
      } catch {
        return null;
      }
    },
  };
}
