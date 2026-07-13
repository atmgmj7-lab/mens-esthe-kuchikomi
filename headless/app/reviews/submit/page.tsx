import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewSubmitForm } from "@/components/reviews/ReviewSubmitForm";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import { pageMetadata } from "@/lib/seo";
import { getShopBySlug } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "口コミを投稿する",
  description:
    "実際に利用した方の口コミを募集しています。投稿内容は運営側で確認後、掲載されます。",
  path: "/reviews/submit/",
  robots: {
    index: false,
    follow: false
  }
});

type Props = {
  searchParams: Promise<{ shop?: string | string[] }>;
};

export default function ReviewSubmitPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<RoutePageFallback variant="static" />}>
      <ReviewSubmitPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewSubmitPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const rawShop = params.shop;
  const shopSlug = typeof rawShop === "string" ? rawShop.trim() : "";

  if (!shopSlug) {
    return (
      <main id="main_content" className="l-mainContent l-article">
        <div className="l-mainContent__inner hl-page-inner">
          <section className="hl-contact-section">
            <h1 className="hl-contact-heading">口コミを投稿する</h1>
            <p className="hl-review-form__lead">
              店舗が指定されていません。店舗一覧または店舗詳細ページから口コミ投稿へ進んでください。
            </p>
            <p>
              <Link href="/area/nihonbashi/#shop-list" className="area-hub-btn area-hub-btn--primary">
                日本橋の店舗一覧へ
              </Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  const shop = await getShopBySlug(shopSlug);

  if (!shop) {
    return (
      <main id="main_content" className="l-mainContent l-article">
        <div className="l-mainContent__inner hl-page-inner">
          <section className="hl-contact-section">
            <h1 className="hl-contact-heading">口コミを投稿する</h1>
            <p className="hl-contact-error" role="alert">
              指定された店舗が見つかりません。URLをご確認ください。
            </p>
            <p>
              <Link href="/shops/" className="area-hub-btn area-hub-btn--outline">
                店舗一覧へ
              </Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main id="main_content" className="l-mainContent l-article">
      <div className="l-mainContent__inner hl-page-inner">
        <section className="hl-contact-section" aria-labelledby="review-submit-heading">
          <h1 id="review-submit-heading" className="hl-contact-heading">
            口コミを投稿する
          </h1>
          <p className="hl-review-form__lead">
            実際に利用した方の口コミを募集しています。投稿内容は運営側で確認後、掲載されます。
          </p>
          <ReviewSubmitForm shopSlug={shop.slug} shopTitle={shop.title} />
        </section>
      </div>
    </main>
  );
}
