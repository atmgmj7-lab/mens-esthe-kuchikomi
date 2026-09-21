import type { Metadata } from "next";

import { PartnerLoginForm } from "@/components/partner/PartnerLoginForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "パートナーログイン",
  description: "Eskomi Free Official Partner向けログイン",
  path: "/partner/login/",
  robots: { index: false, follow: false },
});

export default function PartnerLoginPage() {
  return (
    <main id="main_content" className="l-mainContent l-article">
      <div className="l-mainContent__inner hl-page-inner">
        <section className="hl-contact-section" aria-labelledby="partner-login-heading">
          <h1 id="partner-login-heading" className="hl-contact-heading">パートナーログイン</h1>
          <p>招待済みの店舗担当者は、登録済みメールアドレスへログイン用リンクを送信できます。</p>
          <PartnerLoginForm />
        </section>
      </div>
    </main>
  );
}
