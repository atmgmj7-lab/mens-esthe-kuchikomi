import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PartnerLoginEmailSettings } from "@/components/partner/PartnerLoginEmailSettings";
import { getPartnerLoginEmailManagement } from "@/lib/partner/partner-login-email-service";
import { PARTNER_SESSION_COOKIE, authorizePartnerLoginEmailSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const instant = false;
export const metadata: Metadata = pageMetadata({ title: "ログインメール | パートナー", description: "Eskomi Partnerのログインメール設定", path: "/partner/settings/", robots: { index: false, follow: false } });

export default async function PartnerSettingsPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const session = await authorizePartnerLoginEmailSession({ accessToken });
  if (session.status !== "allowed") redirect("/partner/login/");
  const management = await getPartnerLoginEmailManagement(session.access.workspaceId, session.authUser.id);
  if (management.status === "forbidden" || management.status === "unavailable") redirect("/partner/login/");
  return <main id="main_content" className="l-mainContent l-article hl-partner-home" data-partner-login-email-settings-root>
    <div className="l-mainContent__inner hl-page-inner hl-partner-home__inner">
      <p><a className="hl-partner-home__text-link" href="/partner/">ダッシュボードへ戻る</a></p>
      <PartnerLoginEmailSettings currentEmail={session.authUser.email} pendingEmail={management.email} pendingIntent={management.intent} />
    </div>
  </main>;
}
