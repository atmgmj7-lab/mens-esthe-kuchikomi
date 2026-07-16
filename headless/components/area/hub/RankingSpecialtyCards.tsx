"use client";

import { outboundRelForPromotion } from "@/lib/promotion-disclosure";

import Link from "next/link";
import { ShopImageThumb } from "@/components/area/hub/ShopImageThumb";
import { PriceLabel } from "@/components/common/PriceLabel";
import {
  resolveShopRelationLabel,
  shopBeginnerFeatureLabel,
  shopHoursText,
  shopNearestStation
} from "@/lib/area-shop-utils";
import type { AreaView, ShopView } from "@/lib/wp/types";

type Variant = "late-night" | "beginner" | "station";

export function RankingSpecialtyCards({
  shops,
  targetArea,
  variant
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  variant: Variant;
}) {
  return (
    <div className={`ranking-specialty-cards ranking-specialty-cards--${variant}`}>
      {shops.map((shop) => {
        const hours = shopHoursText(shop);
        const station = shopNearestStation(shop);
        const relation = resolveShopRelationLabel(shop, targetArea);
        const beginnerFeature = shopBeginnerFeatureLabel(shop);

        return (
          <article key={shop.id} className={`ranking-specialty-card ranking-specialty-card--${variant}`}>
            <Link href={`/shops/${shop.slug}/`} className="ranking-specialty-card__media">
              <ShopImageThumb src={shop.imageUrl} alt={shop.title} size="compact" />
            </Link>

            <div className="ranking-specialty-card__body">
              <h3 className="ranking-specialty-card__title">
                <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
              </h3>

              {variant === "late-night" ? (
                <p className="ranking-specialty-card__hours-badge" title={hours}>
                  {hours}
                </p>
              ) : null}

              {variant === "beginner" ? (
                <p className="ranking-specialty-card__beginner-feature">
                  明示特徴: {beginnerFeature}
                </p>
              ) : null}

              {variant === "station" && station ? (
                <div className="ranking-specialty-card__access">
                  <span className="ranking-specialty-card__station-badge">{station}</span>
                  <span className="ranking-specialty-card__relation">{relation}</span>
                </div>
              ) : null}

              <div className="ranking-specialty-card__meta">
                <span>
                  <PriceLabel shop={shop} />
                </span>
                {variant !== "late-night" ? <span className="ranking-specialty-card__hours">{hours}</span> : null}
              </div>

              <div className="ranking-specialty-card__actions">
                <Link href={`/shops/${shop.slug}/`} className="area-hub-btn area-hub-btn--primary area-hub-btn--sm">
                  詳細
                </Link>
                {shop.officialUrl ? (
                  <a
                    href={shop.officialUrl}
                    className="area-hub-btn area-hub-btn--outline area-hub-btn--sm"
                    target="_blank"
                    rel={outboundRelForPromotion(shop.ranking.promotion)}
                  >
                    公式
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
