import type { Metadata } from "next";
import { resolveShopAreaTerm } from "@/lib/shop-contact";
import { formatPriceForDisplay, resolveShopPrimaryPrice, shouldOutputPriceSchema } from "@/lib/price-normalization";
import { stripHtml } from "@/lib/wp/client";
import type { AreaView, ShopView } from "@/lib/wp/types";

export const SITE_URL = "https://mens-esthe-kuchikomi.com";
export const SITE_NAME = "Escomi | 関西メンズエステ口コミナビ";
export const SITE_DESCRIPTION =
  "関西メンズエステの店舗情報・口コミ投稿ポータル。エリア、料金、営業時間、出勤状況から店舗を探せます。";

export function canonicalUrl(path: string): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  const [pathname, query = ""] = path.split("?");
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`;
  const base = `${SITE_URL}${withSlash}`;
  return query ? `${SITE_URL}${normalized}?${query}` : base;
}

export function pageMetadata({
  title,
  description,
  path,
  canonicalOverride,
  robots
}: {
  title: string;
  description: string;
  path: string;
  canonicalOverride?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const canonical = canonicalOverride ?? canonicalUrl(path);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Escomi",
      locale: "ja_JP",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    },
    robots
  };
}

export function makeDescription(value: unknown, fallback: string): string {
  const text = stripHtml(value);
  const source = text || fallback;
  return source.length > 120 ? `${source.slice(0, 117)}...` : source;
}

function faqDisplayText(value: unknown): string {
  return stripHtml(value)
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function asFaqRows(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const question = faqDisplayText(record.question);
      const answer = typeof record.answer === "string" ? record.answer : stripHtml(record.answer);
      if (!question || !faqDisplayText(answer)) return null;
      return { question, answer };
    })
    .filter((row): row is { question: string; answer: string } => Boolean(row));
}

export function faqJsonLd(rows: Array<{ question: string; answer: string }>): Record<string, unknown> | null {
  const mainEntity = rows
    .map((row) => {
      const question = faqDisplayText(row.question);
      const answer = faqDisplayText(row.answer);
      if (!question || !answer) return null;

      return {
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer
        }
      };
    })
    .filter((row): row is {
      "@type": "Question";
      name: string;
      acceptedAnswer: {
        "@type": "Answer";
        text: string;
      };
    } => Boolean(row));

  if (mainEntity.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Escomi",
    alternateName: "関西メンズエステ口コミナビ エスコミ",
    url: canonicalUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "ja"
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Escomi",
    alternateName: "関西メンズエステ口コミナビ エスコミ",
    url: canonicalUrl("/"),
    logo: "https://mens-esthe-kuchikomi.com/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png"
  };
}

export function areaBreadcrumbJsonLd(
  area: AreaView,
  parent?: AreaView | null
): Record<string, unknown> {
  const items: Array<{ name: string; item: string }> = [
    { name: "TOP", item: canonicalUrl("/") },
    { name: "エリア一覧", item: canonicalUrl("/shops/") }
  ];
  if (parent) {
    items.push({ name: parent.name, item: canonicalUrl(`/area/${parent.slug}/`) });
  }
  items.push({ name: area.name, item: canonicalUrl(`/area/${area.slug}/`) });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item
    }))
  };
}

export function shopItemListJsonLd(
  shops: ShopView[],
  listName: string,
  path: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: canonicalUrl(path),
    numberOfItems: shops.length,
    itemListElement: shops.map((shop, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: canonicalUrl(`/shops/${shop.slug}/`),
      name: shop.title
    }))
  };
}

export function shopLocalBusinessJsonLd(shop: ShopView): Record<string, unknown> {
  const tel = stripHtml(shop.acf.shop_tel);
  const address = stripHtml(shop.acf.shop_address);
  const areaTerm = resolveShopAreaTerm(shop);
  const primaryPrice = resolveShopPrimaryPrice(shop.acf);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: shop.title,
    url: canonicalUrl(`/shops/${shop.slug}/`)
  };

  if (tel) data.telephone = tel;
  if (address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: address,
      addressCountry: "JP"
    };
  }
  if (shouldOutputPriceSchema(primaryPrice)) {
    data.priceRange = formatPriceForDisplay(primaryPrice, "〜");
  }

  const areaServed = areaTerm?.name;
  if (areaServed) {
    data.areaServed = {
      "@type": "Place",
      name: areaServed
    };
  }

  return data;
}
