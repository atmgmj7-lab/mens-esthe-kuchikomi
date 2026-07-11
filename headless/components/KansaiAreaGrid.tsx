"use client";

import { useState } from "react";
import Link from "next/link";
import { KANSAI_AREAS, KANSAI_TILE_IMAGES } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";
import { SectionTitle } from "@/components/SectionTitle";

function formatShopCount(count: number) {
  return count > 0 ? `${count}店舗` : "掲載準備中";
}

function splitFeaturedAreas(value: string) {
  return value.split("・").map((item) => item.trim()).filter(Boolean);
}

export function KansaiAreaGrid({ areas }: { areas: AreaView[] }) {
  const countBySlug = Object.fromEntries(areas.map((area) => [area.slug, area.count]));
  const [activeSlug, setActiveSlug] = useState<string>(KANSAI_AREAS[0]?.slug ?? "osaka");

  return (
    <section className="mep-area-section escomi-final-prefecture-section hl-fade-in" aria-labelledby="prefecture-accordion-title">
      <div className="mep-container">
        <div className="escomi-final-section-heading">
          <SectionTitle jp="人気エリアから探す" center />
          <p>写真で地域の雰囲気を確認しながら、都道府県ページへ進めます。</p>
        </div>
        <div
          className="escomi-prefecture-accordion"
          role="list"
          onMouseLeave={() => setActiveSlug(KANSAI_AREAS[0]?.slug ?? "osaka")}
        >
          {KANSAI_AREAS.map((item) => {
            const count = countBySlug[item.slug] ?? 0;
            const hasShops = count > 0;
            const isActive = activeSlug === item.slug;
            const destination = hasShops ? `/area/${item.slug}/` : "/contact/";
            const ctaLabel = hasShops ? `${item.name}の店舗を見る` : "掲載について問い合わせる";
            const featuredAreas = splitFeaturedAreas(item.sub);

            return (
              <Link
                key={item.slug}
                href={destination}
                role="listitem"
                className={`escomi-prefecture-card escomi-prefecture-card--${item.slug}${isActive ? " is-active" : ""}${hasShops ? "" : " is-preparing"}`}
                style={{ backgroundImage: `url(${KANSAI_TILE_IMAGES[item.slug]})` }}
                aria-expanded={isActive}
                aria-controls={`prefecture-panel-${item.slug}`}
                aria-label={`${item.name}エリア。${formatShopCount(count)}。${ctaLabel}`}
                onMouseEnter={() => setActiveSlug(item.slug)}
                onPointerEnter={() => setActiveSlug(item.slug)}
                onFocus={() => setActiveSlug(item.slug)}
              >
                <span className="escomi-prefecture-card__shade" aria-hidden="true" />
                <span className="escomi-prefecture-card__content" id={`prefecture-panel-${item.slug}`}>
                  <span className="escomi-prefecture-card__eyebrow">{item.en}</span>
                  <span className="escomi-prefecture-card__title-row">
                    <span className="escomi-prefecture-card__title">{item.name}</span>
                    <span className="escomi-prefecture-card__count">{formatShopCount(count)}</span>
                  </span>
                  <span className="escomi-prefecture-card__areas" aria-label={`${item.name}の代表地域`}>
                    {featuredAreas.map((areaName) => (
                      <span key={areaName}>{areaName}</span>
                    ))}
                  </span>
                  <span className="escomi-prefecture-card__meta">
                    {hasShops ? "口コミは承認制で掲載" : "現在掲載店舗はありません"}
                    <span aria-hidden="true">・</span>
                    更新: 集計準備中
                  </span>
                  <span className="escomi-prefecture-card__cta">{ctaLabel}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
