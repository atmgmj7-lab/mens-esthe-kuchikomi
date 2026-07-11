import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import Link from "next/link";
import { phoneHref, shopContactLinks } from "@/lib/shop-contact";
import type { ShopView } from "@/lib/wp/types";

export function ShopContactCtaPanel({ shop }: { shop: ShopView }) {
  const { tel, line, officialUrl, areaName, areaPageUrl, areaShopsUrl } = shopContactLinks(shop);
  const officialRel = outboundRelForPromotion(shop.ranking.promotion);
  const hasPrimary = Boolean(tel || line || officialUrl);

  if (!hasPrimary && !areaPageUrl) return null;

  return (
    <section id="shop-contact" className="shop-info-section hl-section hl-shop-cta-panel" aria-label="予約・問い合わせ">
      <h2 className="mod-customColor es-sec-title">
        <span className="es-sec-title__en">CONTACT</span>
        <span className="es-sec-title__ja">予約・問い合わせ</span>
      </h2>
      <div className="hl-shop-cta-panel__body">
        <p className="hl-shop-cta-panel__lead">
          {shop.title}へのご予約・お問い合わせはこちらから。{areaName}エリアの他店舗もあわせてご覧いただけます。
        </p>
        <div className="shpc-cta-row hl-shop-cta-panel__actions">
          {tel ? (
            <a className="shpc-btn-tel" href={phoneHref(tel)}>
              電話予約
            </a>
          ) : null}
          {line ? (
            <a className="shpc-btn-line" href={line} target="_blank" rel="noreferrer">
              LINE予約
            </a>
          ) : null}
          {officialUrl ? (
            <a
              className="mep-cta-btn mep-cta-btn--outline hl-shop-cta-panel__web"
              href={officialUrl}
              target="_blank"
              rel={officialRel}
            >
              公式サイト
            </a>
          ) : null}
        </div>
        <div className="hl-shop-cta-panel__nav">
          {areaPageUrl ? (
            <Link href={areaPageUrl} className="hl-shop-cta-panel__link">
              {areaName}エリアページへ
            </Link>
          ) : null}
          {areaShopsUrl ? (
            <Link href={areaShopsUrl} className="hl-shop-cta-panel__link">
              同エリアの店舗を見る
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ShopContactFixedBar({ shop }: { shop: ShopView }) {
  const { tel, line, officialUrl } = shopContactLinks(shop);
  const officialRel = outboundRelForPromotion(shop.ranking.promotion);
  const items: { href: string; label: string; className: string; external?: boolean; rel?: string }[] = [];

  if (tel) {
    items.push({ href: phoneHref(tel), label: "電話", className: "shpc-btn-tel" });
  }
  if (line) {
    items.push({
      href: line,
      label: "LINE",
      className: "shpc-btn-line",
      external: true
    });
  }
  if (officialUrl) {
    items.push({
      href: officialUrl,
      label: "公式",
      className: "hl-shop-fixed-cta__web",
      external: true,
      rel: officialRel
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="hl-shop-fixed-cta" aria-label="予約・問い合わせ（固定）">
      {items.slice(0, 3).map((item) =>
        item.external ? (
          <a
            key={item.label}
            className={`hl-shop-fixed-cta__btn ${item.className}`}
            href={item.href}
            target="_blank"
            rel={item.rel ?? "noreferrer"}
          >
            {item.label}
          </a>
        ) : (
          <a key={item.label} className={`hl-shop-fixed-cta__btn ${item.className}`} href={item.href}>
            {item.label}
          </a>
        )
      )}
    </div>
  );
}
