import { pathToFileURL } from "node:url";

export const P1_RANK_WP_SHOP_ID = 768;

const SITE_URL = "https://mens-esthe-kuchikomi.com";
const AUTH_USER_PAGE_SIZE = 1000;
const AUTH_USER_MAX_PAGES = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export class P1RankMembershipOperatorError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function configuredString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedSupabaseUrl(value) {
  const configured = configuredString(value);
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizedEmail(value) {
  const email = configuredString(value)?.toLowerCase() ?? "";
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function normalizedRole(value) {
  return value === "owner" || value === "manager" ? value : null;
}

function normalizedWorkspaceId(value) {
  const workspaceId = configuredString(value);
  return workspaceId && UUID_RE.test(workspaceId) ? workspaceId.toLowerCase() : null;
}

function normalizeShopSlug(value) {
  const raw = configuredString(value);
  if (!raw) return null;
  try {
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function maskUuid(value) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function serverHeaders(serviceRoleKey, extra = {}) {
  const headers = {
    apikey: serviceRoleKey,
    ...extra,
  };
  if (LEGACY_SERVICE_ROLE_JWT_RE.test(serviceRoleKey)) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

async function readJson(response, fallbackCode) {
  try {
    return await response.json();
  } catch {
    throw new P1RankMembershipOperatorError(fallbackCode);
  }
}

async function resolveCanonicalRankShop(fetchImpl) {
  const response = await fetchImpl(`${SITE_URL}/wp-json/wp/v2/shop/${P1_RANK_WP_SHOP_ID}?_embed=1`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new P1RankMembershipOperatorError("canonical-shop-unavailable");
  const shop = await readJson(response, "canonical-shop-unavailable");
  const slug = normalizeShopSlug(shop?.slug);
  if (!shop || shop.id !== P1_RANK_WP_SHOP_ID || !slug) {
    throw new P1RankMembershipOperatorError("canonical-shop-mismatch");
  }
  return {
    id: P1_RANK_WP_SHOP_ID,
    slug,
    canonicalUrl: `${SITE_URL}/shops/${slug}/`,
  };
}

function parseAuthUser(value, expectedEmail) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = typeof value.id === "string" && UUID_RE.test(value.id) ? value.id.toLowerCase() : null;
  const email = normalizedEmail(value.email);
  return id && email === expectedEmail ? { id, email } : null;
}

async function listExactAuthUsers({ baseUrl, serviceRoleKey, email, fetchImpl }) {
  const matches = [];
  for (let page = 1; page <= AUTH_USER_MAX_PAGES; page += 1) {
    const url = new URL(`${baseUrl}/auth/v1/admin/users`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(AUTH_USER_PAGE_SIZE));
    const response = await fetchImpl(url, {
      method: "GET",
      headers: serverHeaders(serviceRoleKey),
      cache: "no-store",
    });
    if (!response.ok) throw new P1RankMembershipOperatorError("auth-lookup-unavailable");
    const body = await readJson(response, "auth-lookup-unavailable");
    const users = Array.isArray(body?.users) ? body.users : null;
    if (!users) throw new P1RankMembershipOperatorError("auth-lookup-unavailable");
    for (const user of users) {
      const exact = parseAuthUser(user, email);
      if (exact) matches.push(exact);
    }
    if (users.length < AUTH_USER_PAGE_SIZE) return matches;
  }
  throw new P1RankMembershipOperatorError("auth-lookup-incomplete");
}

async function createAuthUser({ baseUrl, serviceRoleKey, email, fetchImpl }) {
  const response = await fetchImpl(`${baseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: serverHeaders(serviceRoleKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, email_confirm: false }),
    cache: "no-store",
  });
  if (!response.ok) throw new P1RankMembershipOperatorError("auth-create-unavailable");
  const body = await readJson(response, "auth-create-unavailable");
  const user = parseAuthUser(body?.user ?? body, email);
  if (!user) throw new P1RankMembershipOperatorError("auth-create-mismatch");
  return user;
}

async function deleteNewlyCreatedAuthUser({ baseUrl, serviceRoleKey, authUserId, fetchImpl }) {
  const response = await fetchImpl(`${baseUrl}/auth/v1/admin/users/${authUserId}`, {
    method: "DELETE",
    headers: serverHeaders(serviceRoleKey),
    cache: "no-store",
  });
  return response.ok;
}

function parseMembershipGrant(value, expected) {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== "object") return null;
  const row = value[0];
  if (row.workspace_id !== expected.workspaceId
    || row.auth_user_id !== expected.authUserId
    || row.wp_shop_id !== expected.wpShopId
    || row.role !== expected.role
    || row.status !== "active"
    || (row.result !== "created" && row.result !== "already_present")) return null;
  return row;
}

async function grantMembership({ baseUrl, serviceRoleKey, canonicalShop, workspaceId, authUserId, role, fetchImpl }) {
  const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/grant_partner_membership`, {
    method: "POST",
    headers: serverHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      "Content-Profile": "api",
      "Accept-Profile": "api",
    }),
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_auth_user_id: authUserId,
      p_wp_shop_id: canonicalShop.id,
      p_shop_slug: canonicalShop.slug,
      p_canonical_url: canonicalShop.canonicalUrl,
      p_role: role,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new P1RankMembershipOperatorError("membership-grant-unavailable");
  const grant = parseMembershipGrant(await readJson(response, "membership-grant-unavailable"), {
    workspaceId,
    authUserId,
    wpShopId: canonicalShop.id,
    role,
  });
  if (!grant) throw new P1RankMembershipOperatorError("membership-binding-mismatch");
  return grant;
}

/**
 * This operation is intentionally executable only by a trusted server runner.
 * It accepts no browser request data, resolves WP Shop 768 itself, and returns
 * a masked readback that contains neither contact PII nor credentials.
 */
export async function runP1RankAuthMembershipOperator({ environment = process.env, fetchImpl = fetch } = {}) {
  const baseUrl = normalizedSupabaseUrl(environment.SUPABASE_URL);
  const serviceRoleKey = configuredString(environment.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = normalizedWorkspaceId(environment.P1_RANK_WORKSPACE_ID);
  const email = normalizedEmail(environment.P1_RANK_CONTACT_EMAIL);
  const role = normalizedRole(environment.P1_RANK_PARTNER_ROLE);
  const confirmedIdentity = environment.P1_RANK_CONTACT_IDENTITY_CONFIRMED === "true";
  const createIfMissing = environment.P1_RANK_CREATE_AUTH_USER === "true";
  if (!baseUrl || !serviceRoleKey || !workspaceId || !email || !role || !confirmedIdentity) {
    throw new P1RankMembershipOperatorError("operator-precondition-failed");
  }

  const canonicalShop = await resolveCanonicalRankShop(fetchImpl);
  const users = await listExactAuthUsers({ baseUrl, serviceRoleKey, email, fetchImpl });
  if (users.length > 1) throw new P1RankMembershipOperatorError("auth-ambiguous");

  let authUser = users[0] ?? null;
  let authUserCreated = false;
  if (!authUser) {
    if (!createIfMissing) throw new P1RankMembershipOperatorError("auth-not-found");
    authUser = await createAuthUser({ baseUrl, serviceRoleKey, email, fetchImpl });
    authUserCreated = true;
  }

  let membership;
  try {
    membership = await grantMembership({
      baseUrl,
      serviceRoleKey,
      canonicalShop,
      workspaceId,
      authUserId: authUser.id,
      role,
      fetchImpl,
    });
  } catch (error) {
    if (!authUserCreated) throw error;
    const rolledBack = await deleteNewlyCreatedAuthUser({
      baseUrl,
      serviceRoleKey,
      authUserId: authUser.id,
      fetchImpl,
    }).catch(() => false);
    throw new P1RankMembershipOperatorError(
      rolledBack ? "membership-grant-rolled-back" : "membership-grant-rollback-required",
    );
  }

  return {
    outcome: membership.result,
    authUser: maskUuid(authUser.id),
    workspace: maskUuid(workspaceId),
    wpShopId: canonicalShop.id,
    role,
    membershipStatus: membership.status,
    authUserCreated,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runP1RankAuthMembershipOperator()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      const code = error instanceof P1RankMembershipOperatorError ? error.code : "operator-unavailable";
      process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
      process.exitCode = 1;
    });
}
