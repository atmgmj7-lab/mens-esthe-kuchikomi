import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import Link from "next/link";
import { ShopCardLuxury } from "@/components/area/hub/ShopCardLuxury";
import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
import { PriceLabel } from "@/components/common/PriceLabel";
import { RatingBadge } from "@/components/common/RatingBadge";
import { getHubTemplateConfig } from "@/lib/area-hub-config";
import {
  buildEditorCommentShort,
  groupShopsByRelation,
  primaryGroupTitle,
  resolveShopLastVerifiedLabel,
  resolveShopRelationLabel,
  secondaryGroupTitle,
  shopAreaLabel,
  shopFeatureTags,
  shopHoursText,
  shopNearestStation,
  shopReviewCountLabel
} from "@/lib/area-shop-utils";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import type { AreaView, ShopView } from "@/lib/wp/types";

export function AreaShopCard({
  shop,
  targetArea
}: {
  shop: ShopView;
  targetArea: Pick<AreaView, "slug" | "name">;
}) {
  const image = shop.imageUrl || DEFAULT_SHOP_IMAGE;
  const tags = shopFeatureTags(shop, targetArea);
  const relationLabel =
    getHubTemplateConfig(targetArea.slug)?.seo.relationCardLabel ?? "対象エリアとの関係";

  return (
    <article className="area-shop-card hl-card-hover">
      <Link href={`/shops/${shop.slug}/`} className="area-shop-card__img-link">
        <img
          src={image}
          alt={shop.title}
          width={320}
          height={213}
          loading="lazy"
          decoding="async"
        />
      </Link>
      <div className="area-shop-card__body">
        <h3 className="area-shop-card__title">
          <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
        </h3>

        <dl className="area-shop-card__meta">
          <div>
            <dt>エリア</dt>
            <dd>{shopAreaLabel(shop)}</dd>
          </div>
          <div>
            <dt>{relationLabel}</dt>
            <dd>{resolveShopRelationLabel(shop, targetArea)}</dd>
          </div>
          <div>
            <dt>最寄駅・周辺</dt>
            <dd>{shopNearestStation(shop)}</dd>
          </div>
          <div>
            <dt>営業時間</dt>
            <dd>{shopHoursText(shop)}</dd>
          </div>
          <div>
            <dt>料金目安</dt>
            <dd>
              <PriceLabel shop={shop} />
            </dd>
          </div>
          <div>
            <dt>口コミ</dt>
            <dd>{shopReviewCountLabel(shop)}</dd>
          </div>
          <div>
            <dt>公式サイト</dt>
            <dd>{shop.officialUrl ? "あり" : "未掲載"}</dd>
          </div>
        </dl>

        <div className="area-shop-card__tags">
          {tags.map((tag) => (
            <span className="area-shop-card__tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <p className="area-shop-card__editor area-shop-card__editor--clamp">
          {buildEditorCommentShort(shop, targetArea)}
        </p>
        <p className="area-shop-card__verified">確認 {resolveShopLastVerifiedLabel(shop)}</p>

        <div className="area-shop-card__actions">
          <Link href={`/shops/${shop.slug}/`} className="area-hub-btn area-hub-btn--primary">
            店舗詳細を見る
          </Link>
          {shop.officialUrl ? (
            <a
              href={shop.officialUrl}
              className="area-hub-btn area-hub-btn--outline"
              target="_blank"
              rel={outboundRelForPromotion(shop.ranking.promotion)}
            >
              公式サイトを見る
            </a>
          ) : null}
          <Link
            href={buildReviewSubmitUrl(shop.slug)}
            className="area-hub-btn area-hub-btn--outline"
          >
            口コミを書く
          </Link>
        </div>
      </div>
    </article>
  );
}

export function AreaShopList({
  shops,
  targetArea
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
}) {
  const { primary, secondary } = groupShopsByRelation(shops, targetArea);

  return (
    <div className="area-hub-shop-list">
      {primary.length > 0 ? (
        <div className="area-hub-shop-group">
          <h3 className="area-hub-shop-group__title">{primaryGroupTitle(targetArea)}</h3>
          <div className="area-hub-shop-group__list">
            {primary.map((shop) => (
              <ShopCardLuxury key={shop.id} shop={shop} targetArea={targetArea} />
            ))}
          </div>
        </div>
      ) : null}
      {secondary.length > 0 ? (
        <div className="area-hub-shop-group">
          <h3 className="area-hub-shop-group__title">{secondaryGroupTitle(targetArea)}</h3>
          <div className="area-hub-shop-group__list">
            {secondary.map((shop) => (
              <ShopCardLuxury key={shop.id} shop={shop} targetArea={targetArea} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
