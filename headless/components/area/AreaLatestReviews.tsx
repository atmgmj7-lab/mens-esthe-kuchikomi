import Link from "next/link";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import { REVIEW_POLICY_SHORT } from "@/components/area/area-hub-content";
import { AreaHubThemeBanner } from "@/components/area/hub/AreaHubThemeBanner";
import { AreaHubSectionHeader } from "@/components/area/hub/AreaHubSectionHeader";
import { isLayeredBannerSectionEnabled } from "@/lib/area-hub-banner-config";
import { AreaHubSectionShell } from "@/components/area/hub/AreaHubSectionShell";
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

  const reviewsTitle = `${hubContext.name}メンズエステの口コミ・編集部レビュー`;
  const reviewsBannerEnabled = isLayeredBannerSectionEnabled("reviews");

  return (
    <AreaHubSectionShell
      theme="reviews"
      areaSlug={hubContext.slug}
      id="reviews"
      banner={
        reviewsBannerEnabled ? (
          <AreaHubThemeBanner
            hubTheme="reviews"
            areaSlug={hubContext.slug}
            message={reviewsTitle}
          />
        ) : undefined
      }
    >
      {!reviewsBannerEnabled ? (
        <AreaHubSectionHeader
          theme="reviews"
          areaSlug={hubContext.slug}
          ja={reviewsTitle}
        />
      ) : null}

      <details className="area-hub-policy-details">
        <summary>口コミ掲載ポリシー（タップで詳細）</summary>
        <p>{REVIEW_POLICY_SHORT}</p>
      </details>

      {shopsWithReviews.length > 0 ? (
        <div className="area-latest-reviews">
          <ul className="area-latest-reviews__list area-latest-reviews__list--cards">
            {shopsWithReviews.slice(0, 5).map((shop) => (
              <li key={shop.id} className="area-latest-reviews__card">
                <Link href={`/shops/${shop.slug}/`} className="area-latest-reviews__shop">
                  {shop.title}
                </Link>
                <span className="area-latest-reviews__count">口コミ {shopReviewCount(shop)}件</span>
                <Link href={buildReviewSubmitUrl(shop.slug)} className="area-latest-reviews__write">
                  口コミを書く
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="area-latest-reviews area-latest-reviews--empty">
          <p className="area-latest-reviews__cta-title">口コミ受付中</p>
          <p className="area-hub-section__intro area-hub-section__intro--compact">
            短い体験談でも構いません。投稿内容は運営確認後に掲載します。
          </p>
          <div className="area-latest-reviews__actions">
            <Link href={`/area/${hubContext.slug}/#shop-list`} className="area-hub-btn area-hub-btn--primary">
              30秒で口コミを書く
            </Link>
            <Link href={`/area/${hubContext.slug}/#shop-list`} className="area-hub-btn area-hub-btn--outline">
              店舗一覧から探す
            </Link>
          </div>
        </div>
      )}
    </AreaHubSectionShell>
  );
}
