import "server-only";

import { authorizePartnerAccess } from "@/lib/partner/partner-auth";
import { partnerLoginStateMatchesEmail } from "@/lib/partner/partner-auth-login-state";
import { resolvePartnerDashboardIdentity } from "@/lib/partner/partner-dashboard";
import { createPartnerAuthDependencies } from "@/lib/partner/partner-auth-server";
import { resolvePartnerReviewGrowthKit } from "@/lib/partner/partner-review-growth-kit";
import { getPartnerCanonicalGrowth } from "@/lib/supabase/partner-workspace";

export const PARTNER_SESSION_COOKIE = "eskomi_partner_access_token";
export const PARTNER_LOGIN_STATE_COOKIE = "eskomi_partner_login_state";

export async function authorizePartnerSession(input: {
  accessToken: string | null;
  requestedWorkspaceId?: string | null;
  requestedShopId?: number | null;
}) {
  const dependencies = createPartnerAuthDependencies(process.env);
  if (!dependencies) return { status: "unavailable" as const };
  return authorizePartnerAccess({
    accessToken: input.accessToken,
    requestedWorkspaceId: input.requestedWorkspaceId ?? null,
    requestedShopId: input.requestedShopId ?? null,
  }, dependencies);
}

/**
 * Authorizes therapist tools with the same Partner access-token cookie.  It
 * intentionally does not accept a workspace id from a route or form: the
 * service-only membership projection is the authority for the workspace.
 */
export async function authorizePartnerTherapistSession(input: { accessToken: string | null }) {
  const dependencies = createPartnerAuthDependencies(process.env);
  if (!dependencies) return { status: "unavailable" as const };
  const user = await dependencies.getUser(input.accessToken ?? "");
  if (!user) return { status: "unauthenticated" as const };
  const scope = await dependencies.getTherapistWorkspaceScope(user.id);
  if (!scope) return { status: "forbidden" as const };
  return { status: "allowed" as const, access: { ...scope, authUserId: user.id } };
}

export async function authorizePartnerLoginCompletion(input: { accessToken: string; state: string }) {
  const dependencies = createPartnerAuthDependencies(process.env);
  if (!dependencies) return { status: "unavailable" as const };
  const authUser = await dependencies.getUser(input.accessToken);
  if (!authUser || !partnerLoginStateMatchesEmail(input.state, authUser.email, process.env)) {
    return { status: "unauthenticated" as const };
  }
  const access = await authorizePartnerAccess({
    accessToken: input.accessToken,
    requestedWorkspaceId: null,
    requestedShopId: null,
  }, {
    ...dependencies,
    getUser: async (accessToken) => accessToken === input.accessToken ? authUser : null,
  });
  return access;
}

export async function authorizePartnerDashboardSession(input: {
  accessToken: string | null;
  requestedWorkspaceId?: string | null;
  requestedShopId?: number | null;
}) {
  const dependencies = createPartnerAuthDependencies(process.env);
  if (!dependencies) return { status: "unavailable" as const };
  const access = await authorizePartnerAccess({
    accessToken: input.accessToken,
    requestedWorkspaceId: input.requestedWorkspaceId ?? null,
    requestedShopId: input.requestedShopId ?? null,
  }, dependencies);
  if (access.status !== "allowed") return access;
  const user = await dependencies.getUser(input.accessToken ?? "");
  if (!user) return { status: "unauthenticated" as const };
  return resolvePartnerDashboardIdentity(access.access, user.id, dependencies);
}

/**
 * Settings never accept a workspace or user identifier from the browser. The
 * active session is resolved first, then the same session supplies the Auth
 * user whose own login email may be changed.
 */
export async function authorizePartnerLoginEmailSession(input: { accessToken: string | null }) {
  const dependencies = createPartnerAuthDependencies(process.env);
  if (!dependencies) return { status: "unavailable" as const };
  const access = await authorizePartnerAccess({
    accessToken: input.accessToken,
    requestedWorkspaceId: null,
    requestedShopId: null,
  }, dependencies);
  if (access.status !== "allowed") return access;
  const authUser = await dependencies.getUser(input.accessToken ?? "");
  if (!authUser) return { status: "unauthenticated" as const };
  const identity = await resolvePartnerDashboardIdentity(access.access, authUser.id, dependencies);
  if (identity.status !== "allowed") return identity;
  return { status: "allowed" as const, access: access.access, identity: identity.identity, authUser };
}

export async function authorizePartnerReviewGrowthSession(input: {
  accessToken: string | null;
  requestedWorkspaceId?: string | null;
  requestedShopId?: number | null;
}) {
  const dependencies = createPartnerAuthDependencies(process.env);
  if (!dependencies) return { status: "unavailable" as const };
  const access = await authorizePartnerAccess({
    accessToken: input.accessToken,
    requestedWorkspaceId: input.requestedWorkspaceId ?? null,
    requestedShopId: input.requestedShopId ?? null,
  }, dependencies);
  if (access.status !== "allowed") return access;

  const authUser = await dependencies.getUser(input.accessToken ?? "");
  if (!authUser) return { status: "unauthenticated" as const };
  const dashboard = await resolvePartnerDashboardIdentity(access.access, authUser.id, dependencies);
  if (dashboard.status !== "allowed") return dashboard;
  if (dashboard.identity.identityKind === "legacy") {
    // Legacy users retain a successful login and can reach their settings
    // while an operator performs the reviewed app_shop_id mapping.  Do not
    // fabricate canonical links, widgets, or listing mutations for them.
    return { status: "legacy_migration_required" as const, identity: dashboard.identity };
  }

  const metrics = await getPartnerCanonicalGrowth({ workspaceId: access.access.workspaceId, authUserId: authUser.id });
  const growthKit = resolvePartnerReviewGrowthKit(dashboard.identity, metrics);
  if (growthKit.status !== "allowed") return growthKit;
  return { status: "allowed" as const, identity: dashboard.identity, growthKit, metrics };
}
