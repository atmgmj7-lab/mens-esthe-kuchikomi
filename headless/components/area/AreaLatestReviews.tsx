import Link from "next/link";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { buildAreaReviewSubmitUrl, buildReviewSubmitUrl } from "@/lib/review-links";
import { REVIEW_POLICY_SHORT } from "@/components/area/area-hub-content";
import { AreaHubThemeBanner } from "@/components/area/hub/AreaHubThemeBanner";
import { AreaHubSectionHeader } from "@/components/area/hub/AreaHubSectionHeader";
import { isLayeredBannerSectionEnabled } from "@/lib/area-hub-banner-config";
import { AreaHubSectionShell } from "@/components/area/hub/AreaHubSectionShell";
import { shopReviewCount, type AreaHubContext } from "@/lib/area-shop-utils";
import type { ApprovedGlobalReviewResult, ShopView } from "@/lib/wp/types";

export function AreaLatestReviews({
  reviewResult,
  shops,
  hubContext
}: {
  reviewResult?: ApprovedGlobalReviewResult;
  shops?: ShopView[];
  hubContext: AreaHubContext;
}) {
  if (!reviewResult) {
    const shopsWithReviews = (shops ?? []).filter((shop) => shopReviewCount(shop) > 0);
    const reviewsTitle = `${hubContext.name}メンズエステのユーザー口コミ`;
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
          <summary>ユーザー口コミの掲載ポリシー（タップで詳細）</summary>
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
                  <span className="area-latest-reviews__count">確認済み口コミ {shopReviewCount(shop)}件</span>
                  <Link href={buildReviewSubmitUrl(shop.slug)} className="area-latest-reviews__write">
                    口コミを書く
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="area-latest-reviews area-latest-reviews--empty">
            <p className="area-latest-reviews__cta-title">口コミ募集中</p>
            <p className="area-hub-section__intro area-hub-section__intro--compact">
              承認済みのユーザー口コミだけを掲載します。編集部コメントや店舗紹介文は口コミ件数に含めません。
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

  const reviews = reviewResult.status === "available"
    ? reviewResult.page.reviews.slice(0, 6)
    : [];
  if (reviews.length === 0) return null;

  const reviewsTitle = `${hubContext.name}の新着口コミ・体験`;
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
        <summary>承認済みユーザー口コミの掲載ポリシー（タップで詳細）</summary>
        <p>{REVIEW_POLICY_SHORT}</p>
      </details>

      <div className="area-latest-reviews" data-area-approved-reviews="true">
        <div className="area-latest-reviews__grid">
          {reviews.map((review) => (
            <ReviewCard review={review} compact key={review.id} />
          ))}
        </div>
        <div className="area-latest-reviews__actions" aria-label={`${hubContext.name}の口コミ導線`}>
          <Link href="/reviews/" className="area-hub-btn area-hub-btn--outline">
            口コミをもっと見る
          </Link>
          <Link href={buildAreaReviewSubmitUrl(hubContext.slug)} className="area-hub-btn area-hub-btn--primary">
            このエリアの口コミを書く
          </Link>
        </div>
      </div>
    </AreaHubSectionShell>
  );
}
