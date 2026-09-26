import "server-only";

import {
  isPartnerLoginEmailIntentKind,
  normalizePartnerLoginEmail,
  type PartnerLoginEmailIntentKind,
  type PartnerLoginEmailManagement,
} from "@/lib/partner/partner-login-email";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Environment = Readonly<Record<string, string | undefined>>;

export type CanonicalPartnerLoginEmailShop = Readonly<{
  wpShopId: number;
  shopSlug: string;
  canonicalUrl: string;
}>;

function configuredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function configuration(environment: Environment): Readonly<{ baseUrl: string; serviceRoleKey: string }> | null {
  const rawUrl = configuredString(environment.SUPABASE_URL);
  const serviceRoleKey = resolveSupabaseServerSecret(environment)?.value ?? null;
  if (!rawUrl || !serviceRoleKey) return null;
  try {
    const url = new URL(rawUrl);
    const localHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if ((!localHttp && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) return null;
    return { baseUrl: url.toString().replace(/\/$/, ""), serviceRoleKey };
  } catch {
    return null;
  }
}

function serviceHeaders(serviceRoleKey: string): Record<string, string> {
  return createSupabaseServerHeaders(serviceRoleKey, {
    "Content-Type": "application/json",
    "Content-Profile": "api",
    "Accept-Profile": "api",
  });
}

function validCanonicalShop(shop: CanonicalPartnerLoginEmailShop): boolean {
  return Number.isSafeInteger(shop.wpShopId) && shop.wpShopId > 0 && shop.shopSlug.length > 0 && shop.canonicalUrl.startsWith("https://");
}

function parseManagement(value: unknown): PartnerLoginEmailManagement {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== "object") {
    return { status: "unavailable", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null };
  }
  const row = value[0] as Record<string, unknown>;
  const status = row.status;
  if (status !== "available" && status !== "not_set" && status !== "identity_mismatch" && status !== "forbidden") {
    return { status: "unavailable", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null };
  }
  const workspaceId = typeof row.workspace_id === "string" && UUID_RE.test(row.workspace_id) ? row.workspace_id : null;
  const authUserId = typeof row.auth_user_id === "string" && UUID_RE.test(row.auth_user_id) ? row.auth_user_id : null;
  const email = row.email === null ? null : normalizePartnerLoginEmail(row.email);
  const intent = row.intent === null ? null : isPartnerLoginEmailIntentKind(row.intent) ? row.intent : null;
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
  if ((status === "available" || status === "not_set") && !workspaceId) {
    return { status: "unavailable", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null };
  }
  return { status, workspaceId, authUserId, email, intent, updatedAt };
}

async function callApi(
  endpoint: string,
  body: Record<string, unknown>,
  environment: Environment,
  fetchImpl: typeof fetch,
): Promise<PartnerLoginEmailManagement> {
  const configured = configuration(environment);
  if (!configured) return { status: "unavailable", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null };
  try {
    const response = await fetchImpl(`${configured.baseUrl}/rest/v1/rpc/${endpoint}`, {
      method: "POST",
      headers: serviceHeaders(configured.serviceRoleKey),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return response.ok ? parseManagement(await response.json()) : { status: "unavailable", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null };
  } catch {
    return { status: "unavailable", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null };
  }
}

export async function getOperatorPartnerLoginEmailManagement(shop: CanonicalPartnerLoginEmailShop, environment: Environment = process.env, fetchImpl: typeof fetch = fetch) {
  if (!validCanonicalShop(shop)) return { status: "identity_mismatch", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null } as const;
  return callApi("get_operator_partner_login_email_management", {
    p_wp_shop_id: shop.wpShopId, p_shop_slug: shop.shopSlug, p_canonical_url: shop.canonicalUrl,
  }, environment, fetchImpl);
}

export async function setOperatorPartnerLoginEmailIntent(
  shop: CanonicalPartnerLoginEmailShop,
  email: string,
  intent: Extract<PartnerLoginEmailIntentKind, "operator_initial" | "operator_change_requested">,
  environment: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const normalized = normalizePartnerLoginEmail(email);
  if (!validCanonicalShop(shop) || !normalized) return { status: "identity_mismatch", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null } as const;
  return callApi("set_operator_partner_login_email_intent", {
    p_wp_shop_id: shop.wpShopId, p_shop_slug: shop.shopSlug, p_canonical_url: shop.canonicalUrl, p_email: normalized, p_intent: intent,
  }, environment, fetchImpl);
}

export async function getPartnerLoginEmailManagement(
  workspaceId: string,
  authUserId: string,
  environment: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(authUserId)) return { status: "forbidden", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null } as const;
  return callApi("get_partner_login_email_management", { p_workspace_id: workspaceId, p_auth_user_id: authUserId }, environment, fetchImpl);
}

export async function recordPartnerLoginEmailChangeRequest(
  workspaceId: string,
  authUserId: string,
  email: string,
  environment: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const normalized = normalizePartnerLoginEmail(email);
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(authUserId) || !normalized) {
    return { status: "forbidden", workspaceId: null, authUserId: null, email: null, intent: null, updatedAt: null } as const;
  }
  return callApi("record_partner_login_email_change_request", { p_workspace_id: workspaceId, p_auth_user_id: authUserId, p_email: normalized }, environment, fetchImpl);
}
