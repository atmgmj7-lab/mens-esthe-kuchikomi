import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PARTNER_SESSION_COOKIE, authorizePartnerSession } from "@/lib/partner/partner-session";

export const instant = false;

export default async function PartnerAccessPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const access = await authorizePartnerSession({ accessToken });
  if (access.status !== "allowed") redirect("/partner/login/");

  return (
    <main id="main_content" className="l-mainContent l-article">
      <div className="l-mainContent__inner hl-page-inner">
        <section className="hl-contact-section" aria-labelledby="partner-access-heading">
          <h1 id="partner-access-heading" className="hl-contact-heading">パートナーアクセスを確認しました</h1>
          <p>この店舗のパートナー機能は準備中です。</p>
        </section>
      </div>
    </main>
  );
}
