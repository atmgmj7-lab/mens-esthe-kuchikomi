import "server-only";

import { authorizePartnerAccess } from "@/lib/partner/partner-auth";
import { resolvePartnerDashboardIdentity } from "@/lib/partner/partner-dashboard";
import { createPartnerAuthDependencies } from "@/lib/partner/partner-auth-server";
import { resolvePartnerReviewGrowthKit } from "@/lib/partner/partner-review-growth-kit";
import { getPartnerReviewGrowthMetrics } from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";

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
  return resolvePartnerDashboardIdentity(access.access, dependencies);
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

  const dashboard = await resolvePartnerDashboardIdentity(access.access, dependencies);
  if (dashboard.status !== "allowed") return dashboard;

  const metrics = await getPartnerReviewGrowthMetrics(access.access.workspaceId, partnerReviewGrowthRepository);
  const growthKit = resolvePartnerReviewGrowthKit(dashboard.identity, metrics);
  if (growthKit.status !== "allowed") return growthKit;
  return { status: "allowed" as const, identity: dashboard.identity, growthKit, metrics };
}
