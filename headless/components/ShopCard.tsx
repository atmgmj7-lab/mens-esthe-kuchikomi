import Link from "next/link";
import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
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
  variant = "default"
}: {
  shop: ShopView;
  compact?: boolean;
  variant?: "default" | "new";
}) {
  const priceDisplay = resolvePriceDisplay(shop);
  const hours = safeText(shop.acf.shop_hours);
  const basicTime = safeText(shop.acf.basic_time);
  const catchText = safeText(shop.acf.shop_catch, shop.excerpt);
  const onDuty = safeText(shop.acf.shop_availability) === "出勤中" || Boolean(shop.acf.shop_today_analysis);
  const image = shop.imageUrl || DEFAULT_SHOP_IMAGE;

  if (compact) {
    return (
      <article className="shop-list-row hl-card-hover">
        <Link className="shop-row-img" href={`/shops/${shop.slug}/`}>
          <img
            className="shop-thumb"
            src={image}
            alt={shop.title}
            width={100}
            height={100}
            loading="lazy"
            decoding="async"
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
              alt={shop.title}
              width={400}
              height={300}
              loading="lazy"
              decoding="async"
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
            alt={shop.title}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
          />
        </div>
      </Link>
      <div className="mep-card-body">
        <div className="shop-row-tags">
          {shop.terms.slice(0, 2).map((term) => (
            <span className="list-tag tag-gray" key={`${shop.id}-${term.id}`}>
              {term.name}
            </span>
          ))}
        </div>
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
