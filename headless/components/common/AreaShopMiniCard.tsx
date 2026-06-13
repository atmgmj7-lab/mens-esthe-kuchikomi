import Link from "next/link";
import { PriceLabel } from "@/components/common/PriceLabel";
import {
  shopAreaLabel,
  shopFeatureTags,
  shopHoursText,
  shopNearestStation,
  shopReviewCountLabel
} from "@/lib/area-shop-utils";
import type { AreaView, ShopView } from "@/lib/wp/types";

export function AreaShopMiniCard({
  shop,
  rank,
  targetArea
}: {
  shop: ShopView;
  rank?: number;
  targetArea: Pick<AreaView, "slug" | "name">;
}) {
  const tags = shopFeatureTags(shop, targetArea).slice(0, 3);

  return (
    <article className="area-mini-card">
      <div className="area-mini-card__head">
        {rank != null ? <span className="area-mini-card__rank">{rank}</span> : null}
        <h3 className="area-mini-card__title">
          <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
        </h3>
      </div>
      <div className="area-mini-card__meta">
        <span>{shopAreaLabel(shop)}</span>
        <span>{shopNearestStation(shop)}</span>
        <span>
          <PriceLabel shop={shop} />
        </span>
        <span>{shopHoursText(shop)}</span>
        <span>口コミ: {shopReviewCountLabel(shop)}</span>
      </div>
      {tags.length > 0 ? (
        <div className="area-mini-card__tags">
          {tags.map((tag) => (
            <span className="area-mini-card__tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="area-mini-card__actions">
        <Link href={`/shops/${shop.slug}/`} className="area-hub-btn area-hub-btn--primary area-hub-btn--sm">
          詳細
        </Link>
        {shop.officialUrl ? (
          <a
            href={shop.officialUrl}
            className="area-hub-btn area-hub-btn--outline area-hub-btn--sm"
            target="_blank"
            rel="noreferrer"
          >
            公式
          </a>
        ) : null}
      </div>
    </article>
  );
}
