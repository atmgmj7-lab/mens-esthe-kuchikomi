import Link from "next/link";
import { EsSectionTitle } from "@/components/SectionTitle";
import { REVIEW_POLICY } from "@/components/area/area-hub-content";
import { shopReviewCount } from "@/lib/area-shop-utils";
import type { AreaHubContext } from "@/lib/area-shop-utils";
import type { ShopView } from "@/lib/wp/types";

export function AreaLatestReviews({
  shops,
  hubContext
}: {
  shops: ShopView[];
  hubContext: AreaHubContext;
}) {
  const shopsWithReviews = shops.filter((shop) => shopReviewCount(shop) > 0);

  return (
    <section className="area-hub-section" id="reviews">
      <EsSectionTitle
        en="REVIEWS"
        ja={`${hubContext.name}メンズエステの口コミ・編集部レビュー`}
        large
      />

      <div className="area-hub-policy-box">
        <p>{REVIEW_POLICY}</p>
      </div>

      {shopsWithReviews.length > 0 ? (
        <div className="area-latest-reviews">
          <p className="area-hub-section__intro">
            ユーザー投稿口コミが掲載されている店舗です。詳細は各店舗ページでご確認ください。
          </p>
          <ul className="area-latest-reviews__list">
            {shopsWithReviews.slice(0, 5).map((shop) => (
              <li key={shop.id}>
                <Link href={`/shops/${shop.slug}/`}>
                  {shop.title}
                </Link>
                <span className="area-latest-reviews__count">
                  口コミ {shopReviewCount(shop)}件
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="area-latest-reviews area-latest-reviews--empty">
          <p className="area-latest-reviews__cta-title">口コミ募集中</p>
          <p className="area-hub-section__intro">
            {hubContext.name}エリアのメンズエステについて、実際に利用した方の口コミを募集しています。
            投稿いただいた内容は運営確認のうえで掲載します。
          </p>
          <div className="area-latest-reviews__actions">
            <Link href="/contact/" className="area-hub-btn area-hub-btn--primary">
              口コミを投稿する
            </Link>
            <Link href={`/area/${hubContext.slug}/#shop-list`} className="area-hub-btn area-hub-btn--outline">
              店舗一覧から探す
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
