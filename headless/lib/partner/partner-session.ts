import "server-only";

import { authorizePartnerAccess } from "@/lib/partner/partner-auth";
import { createPartnerAuthDependencies } from "@/lib/partner/partner-auth-server";

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
