import type { Metadata } from "next";
import { PartnerRegistrationForm } from "@/components/partner/PartnerRegistrationForm";
import { pageMetadata } from "@/lib/seo";
import { getAllShopsForListing } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "無料公式パートナーを申請",
  description: "Eskomi掲載店舗の無料公式パートナー申請",
  path: "/partner/register/",
  robots: { index: false, follow: false },
});

export default async function PartnerRegisterPage() {
  const shops = await getAllShopsForListing();
  return (
    <main id="main_content" className="l-mainContent l-article">
      <div className="l-mainContent__inner hl-page-inner">
        <section className="hl-contact-section" aria-labelledby="partner-register-heading">
          <h1 id="partner-register-heading" className="hl-contact-heading">無料公式パートナーを申請</h1>
          <p className="hl-review-form__lead">掲載済みの店舗を選択してください。既知の店舗情報を再入力する必要はありません。申請内容と公開情報は運営確認前に自動公開されません。</p>
          <PartnerRegistrationForm shops={shops.map((shop) => ({ id: shop.id, slug: shop.slug, title: shop.title }))} />
        </section>
      </div>
    </main>
  );
}
