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
  role: "shop_card_square";
  width?: number;
  height?: number;
};

export type ShopDetailInfoRow = {
  key: string;
  label: string;
  value: string;
  href?: string;
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
  detailBanner: null;
  prices: ReturnType<typeof resolveShopCoursePrices>;
  infoRows: ShopDetailInfoRow[];
  introductionText: string;
  catchText: string;
  recommendText: string;
  summaryText: string;
  featureNames: string[];
};

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

function shopImages(shop: ShopView): ShopDetailImage[] {
  const card = shop.media?.cardSquare ?? {
    mediaId: null,
    source: shop.imageUrl ? "legacy-acf" as const : "fallback" as const,
    url: shop.imageUrl,
    alt: shop.title,
  };
  const cardUrl = assetUrl(card.url);
  if (!cardUrl || card.source === "fallback") {
    return [
      {
        url: DEFAULT_SHOP_IMAGE,
        alt: `${shop.title} 画像準備中`,
        isFallback: true,
        role: "shop_card_square",
      }
    ];
  }

  return [{
    url: cardUrl,
    alt: displayText(card.alt) || shop.title,
    isFallback: false,
    role: "shop_card_square",
    ...(Number.isSafeInteger(card.width) && Number(card.width) > 0 ? { width: card.width } : {}),
    ...(Number.isSafeInteger(card.height) && Number(card.height) > 0 ? { height: card.height } : {}),
  }];
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
  const station = firstText(acf, ["shop_station", "nearest_station", "station"]);
  const access = firstText(acf, ["shop_access"]);
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
  if (station || access) facts.push({ key: "station", label: "アクセス", value: station || access });
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
    ["station", "最寄駅", station],
    ["access", "アクセス案内", access],
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
    detailBanner: null,
    prices: resolveShopCoursePrices(acf),
    infoRows,
    introductionText: normalizeShopDisplayText(shop.contentHtml),
    catchText: firstText(acf, ["shop_catch"]),
    recommendText: firstText(acf, ["recommend_text"]),
    summaryText: firstText(acf, ["shop_ai_summary"]),
    featureNames: explicitFeatureNames(acf)
  };
}
