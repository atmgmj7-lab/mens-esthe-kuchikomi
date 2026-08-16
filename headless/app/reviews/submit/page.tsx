import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewSubmitForm } from "@/components/reviews/ReviewSubmitForm";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import { filterReviewSubmitShops, normalizeReviewHubQuery } from "@/lib/review-hub";
import { pageMetadata } from "@/lib/seo";
import { getAllShopsForListing, getShopBySlug } from "@/lib/wp/shops";

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
  searchParams: Promise<{ shop?: string | string[]; area?: string | string[] }>;
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
  const areaContext = normalizeReviewHubQuery({ area: params.area }).area;

  if (!shopSlug) {
    const allShops = await getAllShopsForListing();
    const shops = filterReviewSubmitShops(allShops, areaContext);
    const areaName = areaContext
      ? allShops.flatMap((shop) => shop.terms).find((term) => term.slug === areaContext)?.name ?? null
      : null;
    return (
      <main id="main_content" className="l-mainContent l-article">
        <div className="l-mainContent__inner hl-page-inner">
          <section className="hl-contact-section">
            <h1 className="hl-contact-heading">口コミを投稿する</h1>
            <p className="hl-review-form__lead">
              {areaName ? `${areaName}の公開店舗から、口コミの投稿先を選んでください。` : "公開店舗から、口コミの投稿先を選んでください。"}
            </p>
            {shops.length > 0 ? (
              <form className="hl-review-shop-selector" action="/reviews/submit/" method="get">
                {areaContext ? <input type="hidden" name="area" value={areaContext} /> : null}
                <label htmlFor="review-shop-select">口コミを投稿する店舗</label>
                <select id="review-shop-select" name="shop" required defaultValue="">
                  <option value="" disabled>店舗を選択してください</option>
                  {shops.map((shop) => <option value={shop.slug} key={shop.id}>{shop.title}</option>)}
                </select>
                <button type="submit" className="area-hub-btn area-hub-btn--primary">この店舗の投稿画面へ</button>
              </form>
            ) : (
              <p className="hl-contact-error" role="status">指定されたエリアに表示できる公開店舗がありません。</p>
            )}
            <p><Link href="/shops/">店舗一覧を見る</Link></p>
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
