import "server-only";

import type { NextRequest } from "next/server";

import { authorizePartnerTherapistSession, PARTNER_SESSION_COOKIE } from "@/lib/partner/partner-session";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

export const partnerTherapistNoStore = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function partnerTherapistRequestContext(request: NextRequest) {
  const session = await authorizePartnerTherapistSession({
    accessToken: request.cookies.get(PARTNER_SESSION_COOKIE)?.value ?? null,
  });
  if (session.status !== "allowed") return { status: session.status } as const;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return { status: "unavailable" as const };
  return {
    status: "allowed" as const,
    base,
    workspaceId: session.access.workspaceId,
    authUserId: session.access.authUserId,
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }),
  };
}
export const partnerTherapistUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
