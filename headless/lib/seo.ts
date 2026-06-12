import type { Metadata } from "next";
import { stripHtml } from "@/lib/wp/client";
import type { AreaView, ShopView } from "@/lib/wp/types";

export const SITE_URL = "https://mens-esthe-kuchikomi.com";
export const SITE_NAME = "Escomi | 関西メンズエステ口コミナビ";
export const SITE_DESCRIPTION =
  "関西メンズエステの口コミ・店舗情報ポータル。エリア、料金、営業時間、出勤状況から店舗を探せます。";

export function canonicalUrl(path: string): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`;
  return `${SITE_URL}${withSlash}`;
}

export function pageMetadata({
  title,
  description,
  path
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = canonicalUrl(path);
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
    }
  };
}

export function makeDescription(value: unknown, fallback: string): string {
  const text = stripHtml(value);
  const source = text || fallback;
  return source.length > 120 ? `${source.slice(0, 117)}...` : source;
}

export function asFaqRows(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const question = stripHtml(record.question);
      const answer = typeof record.answer === "string" ? record.answer : stripHtml(record.answer);
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((row): row is { question: string; answer: string } => Boolean(row));
}

export function faqJsonLd(rows: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rows.map((row) => ({
      "@type": "Question",
      name: row.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(row.answer)
      }
    }))
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

export function shopLocalBusinessJsonLd(shop: ShopView): Record<string, unknown> {
  const tel = stripHtml(shop.acf.shop_tel);
  const address = stripHtml(shop.acf.shop_address);
  const childArea = shop.terms.find((t) => t.parent !== 0);
  const parentArea = childArea
    ? shop.terms.find((t) => t.id === childArea.parent)
    : shop.terms.find((t) => t.parent === 0);

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
  const areaServed = childArea?.name || parentArea?.name;
  if (areaServed) {
    data.areaServed = {
      "@type": "Place",
      name: areaServed
    };
  }

  return data;
}
