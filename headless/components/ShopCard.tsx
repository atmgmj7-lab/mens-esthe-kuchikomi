import Link from "next/link";
import { ResponsiveTag, ResponsiveTagList } from "@/components/common/ResponsiveTag";
import {
  DEFAULT_SHOP_IMAGE,
  SHOP_FALLBACK_IMAGE_ALT,
  SHOP_FALLBACK_IMAGE_STYLE
} from "@/lib/design-constants";
import { resolvePriceDisplay } from "@/lib/area-shop-utils";
import { safeText } from "@/lib/wp/client";
import type { ShopView } from "@/lib/wp/types";

function areaLabel(shop: ShopView): string {
  const areaTerm = shop.terms.find((t) => t.parent !== 0) || shop.terms[0];
  return areaTerm?.name || "";
}

export function ShopCard({
  shop,
  compact = false,
  variant = "default",
  rank = null
}: {
  shop: ShopView;
  compact?: boolean;
  variant?: "default" | "new";
  rank?: number | null;
}) {
  const priceDisplay = resolvePriceDisplay(shop);
  const hours = safeText(shop.acf.shop_hours);
  const basicTime = safeText(shop.acf.basic_time);
  const catchText = safeText(shop.acf.shop_catch, shop.excerpt);
  const onDuty = safeText(shop.acf.shop_availability) === "出勤中" || Boolean(shop.acf.shop_today_analysis);
  const hasImage = Boolean(shop.imageUrl);
  const image = hasImage ? shop.imageUrl : DEFAULT_SHOP_IMAGE;
  const imageAlt = hasImage ? shop.title : SHOP_FALLBACK_IMAGE_ALT;
  const imageStyle = hasImage ? undefined : SHOP_FALLBACK_IMAGE_STYLE;

  if (compact) {
    return (
      <article className="shop-list-row hl-card-hover">
        {rank ? (
          <span className="shop-list-row__rank" aria-label={`おすすめランキング${rank}位`}>
            {rank}位
          </span>
        ) : null}
        <Link className="shop-row-img" href={`/shops/${shop.slug}/`}>
          <img
            className="shop-thumb"
            src={image}
            alt={imageAlt}
            width={100}
            height={hasImage ? 100 : 75}
            loading="lazy"
            decoding="async"
            style={imageStyle}
          />
        </Link>
        <div className="shop-row-info">
          <div className="shop-row-title-line">
            <h3 className="shop-row-title">
              <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
            </h3>
            {onDuty ? (
              <span className="escomi-archive-badge escomi-archive-badge--active">出勤中</span>
            ) : null}
          </div>
          {catchText ? <p className="shop-row-catch">{catchText}</p> : null}
        </div>
        <div className="shop-row-meta">
          {hours ? <div className="meta-box hours">{hours}</div> : null}
          <div className="meta-box price-area">
            {basicTime ? <span className="meta-time">{basicTime}分</span> : null}
            <span className="meta-price">
              {priceDisplay.label}
            </span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "new") {
    return (
      <article className="mep-feature-card hl-card-hover hl-new-shop-card">
        <Link href={`/shops/${shop.slug}/`} className="mep-shop-link">
          <div className="mep-card-img">
            <img
              className="shop-card__image"
              src={image}
              alt={imageAlt}
              width={400}
              height={300}
              loading="lazy"
              decoding="async"
              style={imageStyle}
            />
            <span className="mep-badge mep-badge--new">NEW</span>
          </div>
        </Link>
        <div className="mep-card-body">
          <span className="mep-area-label">{areaLabel(shop)}</span>
          <h3 className="mep-card-title">
            <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
          </h3>
        </div>
      </article>
    );
  }

  return (
    <article className="mep-feature-card hl-card-hover">
      <Link href={`/shops/${shop.slug}/`} className="mep-shop-link">
        <div className="mep-card-img">
          <img
            className="shop-card__image"
            src={image}
            alt={imageAlt}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            style={imageStyle}
          />
        </div>
      </Link>
      <div className="mep-card-body">
        <ResponsiveTagList className="shop-row-tags" ariaLabel={`${shop.title}のエリア`}>
          {shop.terms.slice(0, 2).map((term) => (
            <ResponsiveTag className="list-tag tag-gray" key={`${shop.id}-${term.id}`} tone="muted">
              {term.name}
            </ResponsiveTag>
          ))}
        </ResponsiveTagList>
        <h3 className="mep-card-title">
          <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
        </h3>
        {catchText ? <p>{catchText}</p> : null}
        {priceDisplay.status === "available" ? (
          <div className="mep-card-price">{priceDisplay.label}</div>
        ) : null}
      </div>
    </article>
  );
}
