"use client";

import Link from "next/link";
import { AreaHubThemeIcon } from "@/components/area/hub/AreaHubThemeIcon";
import { ShopImageThumb } from "@/components/area/hub/ShopImageThumb";
import { ShopInfoChips } from "@/components/area/hub/ShopInfoChips";
import { PriceLabel } from "@/components/common/PriceLabel";
import { RatingBadge } from "@/components/common/RatingBadge";
import {
  buildEditorCommentShort,
  resolveShopLastVerifiedLabel,
  resolveShopRelationLabel,
  shopFeatureTags,
  shopHoursText,
  shopReviewCountLabel
} from "@/lib/area-shop-utils";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import type { AreaView, ShopView } from "@/lib/wp/types";

export function ShopCardLuxury({
  shop,
  targetArea
}: {
  shop: ShopView;
  targetArea: Pick<AreaView, "slug" | "name">;
}) {
  const tags = shopFeatureTags(shop, targetArea);
  const editorComment = buildEditorCommentShort(shop, targetArea);
  const relationLabel = resolveShopRelationLabel(shop, targetArea);

  return (
    <article className="shop-card-luxury hl-card-hover">
      <Link href={`/shops/${shop.slug}/`} className="shop-card-luxury__media">
        <ShopImageThumb src={shop.imageUrl} alt={shop.title} size="card" />
      </Link>

      <div className="shop-card-luxury__body">
        <div className="shop-card-luxury__head">
          <h3 className="shop-card-luxury__title">
            <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
          </h3>
          <ShopInfoChips tags={tags} max={3} />
        </div>

        <dl className="shop-card-luxury__facts shop-card-luxury__facts--icon">
          <div>
            <dt>
              <AreaHubThemeIcon name="price" className="shop-card-luxury__fact-icon" />
              料金
            </dt>
            <dd>
              <PriceLabel shop={shop} />
            </dd>
          </div>
          <div>
            <dt>
              <AreaHubThemeIcon name="late-night" className="shop-card-luxury__fact-icon" />
              営業
            </dt>
            <dd>{shopHoursText(shop)}</dd>
          </div>
          <div>
            <dt>
              <AreaHubThemeIcon name="station" className="shop-card-luxury__fact-icon" />
              エリア
            </dt>
            <dd>{relationLabel}</dd>
          </div>
          <div>
            <dt>
              <AreaHubThemeIcon name="reviews" className="shop-card-luxury__fact-icon" />
              口コミ
            </dt>
            <dd>{shopReviewCountLabel(shop)}</dd>
          </div>
        </dl>

        <div className="shop-card-luxury__meta-row">
          <RatingBadge shop={shop} showValue={false} />
          {shop.officialUrl ? (
            <span className="shop-card-luxury__official">
              <AreaHubThemeIcon name="official" className="shop-card-luxury__fact-icon" />
              公式あり
            </span>
          ) : null}
        </div>

        {editorComment ? (
          <p className="shop-card-luxury__editor">{editorComment}</p>
        ) : null}
        <p className="shop-card-luxury__verified" aria-label="最終確認日">確認 {resolveShopLastVerifiedLabel(shop)}</p>

        <div className="shop-card-luxury__actions">
          <Link href={`/shops/${shop.slug}/`} className="area-hub-btn area-hub-btn--primary area-hub-btn--sm">
            詳細を見る
          </Link>
          <Link
            href={buildReviewSubmitUrl(shop.slug)}
            className="area-hub-btn area-hub-btn--ghost area-hub-btn--sm shop-card-luxury__action-secondary"
          >
            口コミを書く
          </Link>
        </div>
      </div>
    </article>
  );
}
