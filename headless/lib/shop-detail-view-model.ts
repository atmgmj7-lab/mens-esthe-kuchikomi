import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
import {
  formatPriceForDisplay,
  resolveShopCoursePrices,
  resolveShopPrimaryPrice
} from "@/lib/price-normalization";
import {
  normalizeShopAddress,
  normalizeShopDisplayText
} from "@/lib/shop-fact-normalization";
import type { ShopView } from "@/lib/wp/types";

export type ShopDetailFact = {
  key: "price" | "station" | "hours" | "booking";
  label: string;
  value: string;
};

export type ShopDetailAction = {
  kind: "reservation" | "line" | "tel" | "official";
  label: string;
  href: string;
  external: boolean;
};

export type ShopDetailImage = {
  url: string;
  alt: string;
  isFallback: boolean;
};

export type ShopDetailInfoRow = {
  key: string;
  label: string;
  value: string;
  href?: string;
};

export type ShopSectionLink = {
  id: "overview" | "prices" | "hours-access" | "features" | "reviews" | "nearby";
  label: string;
};

export type ShopDetailViewModel = {
  id: number;
  slug: string;
  title: string;
  areaName: string;
  verifiedAt: string | null;
  facts: ShopDetailFact[];
  actions: ShopDetailAction[];
  images: ShopDetailImage[];
  prices: ReturnType<typeof resolveShopCoursePrices>;
  infoRows: ShopDetailInfoRow[];
  introductionText: string;
  catchText: string;
  recommendText: string;
  summaryText: string;
  featureNames: string[];
};

const VISUAL_KEYS = [
  "shop_header_image",
  "header_image",
  "shop_top_image",
  "top_image",
  "shop_hero_image",
  "hero_image",
  "shop_main_visual",
  "main_visual",
  "shop_image",
  "shop_main_image",
  "main_image",
  "image",
  "shop_photo",
  "photo",
  "gallery_image",
  "store_image",
  "thumbnail"
] as const;

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function displayText(value: unknown): string {
  return normalizeShopDisplayText(value);
}

function firstText(acf: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = displayText(acf[key]);
    if (value) return value;
  }
  return "";
}

function httpUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function assetUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(raw)) {
    return raw;
  }
  return httpUrl(raw);
}

function telUrl(value: unknown): string | null {
  const digits = text(value).replace(/[^0-9]/g, "");
  return digits ? `tel:${digits}` : null;
}

function verifiedDate(value: unknown): string | null {
  const raw = normalizeShopDisplayText(value);
  if (!raw) return null;
  const match =
    raw.match(/^(\d{4})-(\d{2})-(\d{2})$/) ||
    raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/) ||
    raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}年${month}月${day}日`;
}

function imageUrl(value: unknown): string | null {
  if (typeof value === "string") return assetUrl(value);
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return assetUrl(item.url) || assetUrl(item.source_url);
}

function shopImages(shop: ShopView): ShopDetailImage[] {
  const candidates = [assetUrl(shop.imageUrl), ...VISUAL_KEYS.map((key) => imageUrl(shop.acf[key]))].filter(
    (url): url is string => Boolean(url)
  );
  const unique = [...new Set(candidates)].slice(0, 4);

  if (unique.length === 0) {
    return [
      {
        url: DEFAULT_SHOP_IMAGE,
        alt: `${shop.title} 画像準備中`,
        isFallback: true
      }
    ];
  }

  return unique.map((url, index) => ({
    url,
    alt: index === 0 ? shop.title : `${shop.title} 店舗画像 ${index + 1}`,
    isFallback: false
  }));
}

function explicitFeatureNames(acf: Record<string, unknown>): string[] {
  const names = [acf.shop_features, acf.features, acf.shop_facilities]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((value) => {
      if (typeof value === "string") return displayText(value);
      if (!value || typeof value !== "object") return "";
      return displayText((value as Record<string, unknown>).name);
    })
    .filter((value): value is string => Boolean(value));

  return [...new Set(names)];
}

export function buildShopDetailViewModel(shop: ShopView, areaName: string): ShopDetailViewModel {
  const acf = shop.acf;
  const primaryPrice = resolveShopPrimaryPrice(acf);
  const priceLabel = formatPriceForDisplay(primaryPrice, "〜");
  const station = firstText(acf, ["shop_station", "nearest_station", "station", "shop_access"]);
  const address = normalizeShopAddress(acf.shop_address);
  const hours = firstText(acf, ["shop_hours"]);
  const bookingUrl =
    ["shop_booking_url", "booking_url", "reservation_url", "shop_reservation_url"]
      .map((key) => httpUrl(acf[key]))
      .find((url): url is string => Boolean(url)) || null;
  const lineUrl = httpUrl(acf.shop_line);
  const phone = telUrl(acf.shop_tel);
  const officialUrl = httpUrl(shop.officialUrl) || httpUrl(acf.official_url);

  const actions: ShopDetailAction[] = [];
  if (bookingUrl) {
    actions.push({ kind: "reservation", label: "空き状況・Web予約", href: bookingUrl, external: true });
  }
  if (lineUrl) {
    actions.push({ kind: "line", label: "LINE予約", href: lineUrl, external: true });
  }
  if (phone) {
    actions.push({ kind: "tel", label: "電話予約", href: phone, external: false });
  }
  if (officialUrl) {
    actions.push({ kind: "official", label: "公式サイトを見る", href: officialUrl, external: true });
  }

  const bookingAction = actions.find((action) => action.kind !== "official");
  const facts: ShopDetailFact[] = [];
  if (priceLabel) facts.push({ key: "price", label: "料金目安", value: priceLabel });
  if (station) facts.push({ key: "station", label: "アクセス", value: station });
  if (hours) facts.push({ key: "hours", label: "営業時間", value: hours });
  if (bookingAction) facts.push({ key: "booking", label: "予約方法", value: bookingAction.label });

  const infoRows: ShopDetailInfoRow[] = [];
  if (address) {
    infoRows.push({
      key: "address",
      label: address.kind === "street-address" ? "住所" : "アクセス案内",
      value: address.text
    });
  }
  for (const [key, label, value] of [
    ["station", "駅・アクセス案内", station],
    ["hours", "営業時間", hours],
    ["holiday", "定休日", firstText(acf, ["shop_holiday"])],
    ["booking", "予約", firstText(acf, ["shop_booking"])],
    ["parking", "駐車場", firstText(acf, ["shop_parking"])]
  ] as const) {
    if (value) infoRows.push({ key, label, value });
  }
  if (officialUrl) {
    infoRows.push({ key: "official", label: "公式サイト", value: "公式サイトを見る", href: officialUrl });
  }

  return {
    id: shop.id,
    slug: shop.slug,
    title: shop.title,
    areaName,
    verifiedAt: verifiedDate(acf.shop_updated_at),
    facts,
    actions,
    images: shopImages(shop),
    prices: resolveShopCoursePrices(acf),
    infoRows,
    introductionText: normalizeShopDisplayText(shop.contentHtml),
    catchText: firstText(acf, ["shop_catch"]),
    recommendText: firstText(acf, ["recommend_text"]),
    summaryText: firstText(acf, ["shop_ai_summary"]),
    featureNames: explicitFeatureNames(acf)
  };
}

export function buildShopSectionLinks(
  model: ShopDetailViewModel,
  { hasReviews, hasNearby }: { hasReviews: boolean; hasNearby: boolean }
): ShopSectionLink[] {
  const links: ShopSectionLink[] = [];
  if (
    model.catchText ||
    model.introductionText ||
    model.recommendText ||
    model.summaryText
  ) {
    links.push({ id: "overview", label: "概要" });
  }
  if (model.prices.length > 0) links.push({ id: "prices", label: "料金" });
  if (model.infoRows.length > 0) {
    links.push({ id: "hours-access", label: "営業時間・アクセス" });
  }
  if (model.featureNames.length > 0) links.push({ id: "features", label: "特徴" });
  if (hasReviews) links.push({ id: "reviews", label: "口コミ" });
  if (hasNearby) links.push({ id: "nearby", label: "近隣店舗" });
  return links;
}
