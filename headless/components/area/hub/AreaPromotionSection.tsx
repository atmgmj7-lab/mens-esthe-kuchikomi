import Link from "next/link";
import { PromotionDisclosureBadge, PromotionDisclosureNote } from "@/components/common/PromotionDisclosureBadge";
import { PriceLabel } from "@/components/common/PriceLabel";
import { outboundRelForPromotion, PROMOTION_SECTION_TITLE } from "@/lib/promotion-disclosure";
import { shopHoursText, shopNearestStation } from "@/lib/area-shop-utils";
import { selectPromotionShops } from "@/lib/shop-ranking";
import type { AreaView, ShopView } from "@/lib/wp/types";

export function AreaPromotionSection({
  shops,
  targetArea,
  limit = 4
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "name" | "slug">;
  limit?: number;
}) {
  const promotionShops = selectPromotionShops(shops, targetArea, limit);

  if (promotionShops.length === 0) return null;

  return (
    <section className="area-promotion-section" aria-labelledby={`${targetArea.slug}-promotion-title`}>
      <div className="area-promotion-section__header">
        <p className="area-promotion-section__eyebrow">ADVERTISING</p>
        <h2 id={`${targetArea.slug}-promotion-title`}>{targetArea.name}の{PROMOTION_SECTION_TITLE}</h2>
        <PromotionDisclosureNote />
      </div>
      <div className="area-promotion-section__grid">
        {promotionShops.map((shop) => (
          <article key={shop.id} className="area-promotion-card" aria-label={`${shop.title}のPR広告枠`}>
            <div className="area-promotion-card__topline">
              <PromotionDisclosureBadge />
              <span>自然ランキングとは別枠</span>
            </div>
            <h3 className="area-promotion-card__title">
              <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
            </h3>
            <dl className="area-promotion-card__meta">
              <div>
                <dt>料金</dt>
                <dd><PriceLabel shop={shop} /></dd>
              </div>
              <div>
                <dt>営業時間</dt>
                <dd>{shopHoursText(shop)}</dd>
              </div>
              <div>
                <dt>最寄駅</dt>
                <dd>{shopNearestStation(shop)}</dd>
              </div>
            </dl>
            <div className="area-promotion-card__actions">
              <Link href={`/shops/${shop.slug}/`} className="area-hub-btn area-hub-btn--primary area-hub-btn--sm">
                詳細を見る
              </Link>
              {shop.officialUrl ? (
                <a
                  href={shop.officialUrl}
                  className="area-hub-btn area-hub-btn--outline area-hub-btn--sm"
                  target="_blank"
                  rel={outboundRelForPromotion(shop.ranking.promotion)}
                >
                  公式サイト
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
