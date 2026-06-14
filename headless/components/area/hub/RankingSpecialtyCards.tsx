"use client";

import Link from "next/link";
import { ShopImageThumb } from "@/components/area/hub/ShopImageThumb";
import { PriceLabel } from "@/components/common/PriceLabel";
import { safeText } from "@/lib/wp/client";
import {
  hasPublishedPrice,
  resolveShopRelationLabel,
  shopHoursText,
  shopNearestStation
} from "@/lib/area-shop-utils";
import type { AreaView, ShopView } from "@/lib/wp/types";

type Variant = "late-night" | "beginner" | "station";

function beginnerChecks(shop: ShopView) {
  return [
    { label: "公式サイトあり", ok: Boolean(shop.officialUrl) },
    { label: "料金掲載あり", ok: hasPublishedPrice(shop) },
    { label: "営業時間掲載", ok: Boolean(safeText(shop.acf.shop_hours)) },
    {
      label: "予約導線あり",
      ok: Boolean(safeText(shop.acf.shop_booking) || safeText(shop.acf.shop_tel))
    }
  ];
}

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
                <ul className="ranking-specialty-card__checks">
                  {beginnerChecks(shop).map((item) => (
                    <li
                      key={item.label}
                      className={item.ok ? "is-ok" : "is-muted"}
                      aria-label={`${item.label}: ${item.ok ? "あり" : "未確認"}`}
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              ) : null}

              {variant === "station" ? (
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
                    rel="noreferrer"
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
