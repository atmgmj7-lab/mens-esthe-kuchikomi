import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PARTNER_SESSION_COOKIE, authorizePartnerDashboardSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const instant = false;

export const metadata: Metadata = pageMetadata({
  title: "パートナーダッシュボード",
  description: "Eskomi Free Official Partner向けダッシュボード",
  path: "/partner/",
  robots: { index: false, follow: false },
});

export default async function PartnerDashboardPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const dashboard = await authorizePartnerDashboardSession({ accessToken });
  if (dashboard.status !== "allowed") redirect("/partner/login/");
  const { identity } = dashboard;
  const partnerStatus = identity.state === "free_official_partner" ? "Free Official Partner" : "Active Partner";

  return (
    <main id="main_content" className="l-mainContent l-article" data-partner-dashboard-root>
      <div className="l-mainContent__inner hl-page-inner">
        <header className="hl-contact-section">
          <p>Eskomi Partner Dashboard</p>
          <h1 className="hl-contact-heading">{identity.shopName}</h1>
          <p>現在のログイン先店舗を確認できます。</p>
          <nav aria-label="パートナーナビゲーション">
            <a href="/partner/" aria-current="page">ダッシュボード</a>
            {" · "}
            <a href={identity.canonicalUrl}>公開店舗ページ</a>
          </nav>
        </header>

        <section className="hl-contact-section" aria-labelledby="partner-shop-identity-heading">
          <h2 id="partner-shop-identity-heading" className="hl-contact-heading">店舗 identity</h2>
          <dl>
            <dt>Eskomi 店舗</dt>
            <dd>{identity.shopName}</dd>
            <dt>店舗 ID</dt>
            <dd>{identity.shopId}</dd>
            <dt>Partner workspace</dt>
            <dd>この店舗に紐づく workspace</dd>
          </dl>
        </section>

        <section className="hl-contact-section" aria-labelledby="partner-status-heading">
          <h2 id="partner-status-heading" className="hl-contact-heading">Partner status</h2>
          <p>{partnerStatus}</p>
        </section>
      </div>
    </main>
  );
}
