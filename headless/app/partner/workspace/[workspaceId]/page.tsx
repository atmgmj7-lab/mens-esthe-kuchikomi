import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PARTNER_SESSION_COOKIE, authorizePartnerSession } from "@/lib/partner/partner-session";

export const instant = false;

export default async function PartnerWorkspaceAccessPage({
  params,
}: Readonly<{ params: Promise<{ workspaceId: string }> }>) {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const access = await authorizePartnerSession({
    accessToken,
    requestedWorkspaceId: (await params).workspaceId,
  });
  if (access.status !== "allowed") redirect("/partner/login/");
  redirect("/partner/");
}
