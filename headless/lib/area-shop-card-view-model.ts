import {
  DEFAULT_SHOP_IMAGE,
  SHOP_FALLBACK_IMAGE_ALT
} from "@/lib/design-constants";
import {
  formatPriceForDisplay,
  resolveShopCoursePrices,
  resolveShopPrimaryPrice
} from "@/lib/price-normalization";
import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import {
  normalizeShopAddress,
  normalizeShopDisplayText
} from "@/lib/shop-fact-normalization";
import type { AreaView, ShopView } from "@/lib/wp/types";

export type AreaShopCardViewModelOptions = {
  rank?: number | null;
  showRank?: boolean;
  summarySource?: "wordpress-only";
  maxActions?: 2;
};

export type AreaShopCardImage = {
  src: string;
  alt: string;
  isFallback: boolean;
};

export type AreaShopCardTitle = {
  text: string;
  href: string;
};

export type AreaShopCardTag = {
  label: string;
  kind: "feature" | "promotion";
};

export type AreaShopCardFact = {
  key: "price" | "station" | "hours";
  label: string;
  value: string;
};

export type AreaShopCardAction = {
  kind: "reservation" | "official" | "line" | "tel";
  label: string;
  href: string;
  external: boolean;
  primary: boolean;
  rel: string;
};

export type AreaShopCardQuickLink = {
  key: "price" | "data" | "reviews";
  label: string;
  href: string;
};

export type AreaShopCardViewModel = {
  rank: number | null;
  image: AreaShopCardImage;
  title: AreaShopCardTitle;
  summary: string | null;
  tags: AreaShopCardTag[];
  facts: AreaShopCardFact[];
  actions: AreaShopCardAction[];
  quickLinks: AreaShopCardQuickLink[];
};

const STATION_KEYS = ["shop_station", "nearest_station", "station", "shop_access"] as const;
const BOOKING_URL_KEYS = [
  "shop_booking_url",
  "booking_url",
  "reservation_url",
  "shop_reservation_url"
] as const;

function firstDisplayText(acf: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = normalizeShopDisplayText(acf[key]);
    if (value) return value;
  }
  return "";
}

function assetUrl(value: unknown): string | null {
  const raw = normalizeShopDisplayText(value);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(raw)) {
    return raw;
  }
  return httpUrl(raw);
}

function httpUrl(value: unknown): string | null {
  const raw = normalizeShopDisplayText(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function telUrl(value: unknown): string | null {
  const digits = normalizeShopDisplayText(value).replace(/[^0-9]/g, "");
  return digits ? `tel:${digits}` : null;
}

function featureTags(shop: ShopView): AreaShopCardTag[] {
  const promotion = shop.ranking.promotion;
  const tags: AreaShopCardTag[] = [];
  if (promotion?.requiresDisclosure && promotion.disclosureLabel) {
    tags.push({ label: promotion.disclosureLabel, kind: "promotion" });
  }

  const features = [shop.acf.shop_features, shop.acf.features, shop.acf.shop_facilities]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((value) => {
      if (typeof value === "string") return normalizeShopDisplayText(value);
      if (!value || typeof value !== "object") return "";
      return normalizeShopDisplayText((value as Record<string, unknown>).name);
    })
    .filter((value): value is string => Boolean(value));

  for (const label of new Set(features)) {
    if (!tags.some((tag) => tag.label === label)) tags.push({ label, kind: "feature" });
  }
  return tags;
}

function summaryText(shop: ShopView, source: "wordpress-only"): string | null {
  if (source !== "wordpress-only") return null;
  const candidates = [
    shop.contentHtml,
    shop.excerpt,
    shop.acf.shop_catch,
    shop.acf.recommend_text,
    shop.acf.shop_ai_summary
  ];
  for (const candidate of candidates) {
    const value = normalizeShopDisplayText(candidate);
    if (value) return value;
  }
  return null;
}

function facts(shop: ShopView): AreaShopCardFact[] {
  const rows: AreaShopCardFact[] = [];
  const price = formatPriceForDisplay(resolveShopPrimaryPrice(shop.acf), "〜");
  const station = firstDisplayText(shop.acf, STATION_KEYS);
  const hours = normalizeShopDisplayText(shop.acf.shop_hours);
  if (price) rows.push({ key: "price", label: "料金目安", value: price });
  if (station) rows.push({ key: "station", label: "アクセス", value: station });
  if (hours) rows.push({ key: "hours", label: "営業時間", value: hours });
  return rows;
}

function actions(shop: ShopView, maxActions: 2): AreaShopCardAction[] {
  const promotion = shop.ranking.promotion;
  const externalRel = outboundRelForPromotion(promotion);
  const booking = BOOKING_URL_KEYS
    .map((key) => httpUrl(shop.acf[key]))
    .find((url): url is string => Boolean(url));
  const official = httpUrl(shop.officialUrl) || httpUrl(shop.acf.official_url);
  const line = httpUrl(shop.acf.shop_line);
  const tel = telUrl(shop.acf.shop_tel);
  const candidates = [
    booking
      ? { kind: "reservation", label: "空き状況・Web予約", href: booking, external: true, rel: externalRel }
      : null,
    official
      ? { kind: "official", label: "公式サイトを見る", href: official, external: true, rel: externalRel }
      : null,
    line
      ? { kind: "line", label: "LINE予約", href: line, external: true, rel: externalRel }
      : null,
    tel
      ? { kind: "tel", label: "電話予約", href: tel, external: false, rel: "" }
      : null
  ].filter((action): action is Omit<AreaShopCardAction, "primary"> => Boolean(action));

  const seen = new Set<string>();
  return candidates
    .filter((action) => {
      if (seen.has(action.href)) return false;
      seen.add(action.href);
      return true;
    })
    .slice(0, maxActions)
    .map((action, index) => ({ ...action, primary: index === 0 }));
}

function quickLinks(shop: ShopView, shopPath: string): AreaShopCardQuickLink[] {
  const links: AreaShopCardQuickLink[] = [];
  if (resolveShopCoursePrices(shop.acf).length > 0) {
    links.push({ key: "price", label: "料金", href: `${shopPath}#prices` });
  }

  const hasDataSection = Boolean(
    normalizeShopAddress(shop.acf.shop_address) ||
      firstDisplayText(shop.acf, STATION_KEYS) ||
      normalizeShopDisplayText(shop.acf.shop_hours) ||
      normalizeShopDisplayText(shop.acf.shop_holiday) ||
      normalizeShopDisplayText(shop.acf.shop_booking) ||
      normalizeShopDisplayText(shop.acf.shop_parking) ||
      httpUrl(shop.officialUrl) ||
      httpUrl(shop.acf.official_url)
  );
  if (hasDataSection) {
    links.push({ key: "data", label: "基本情報", href: `${shopPath}#hours-access` });
  }
  links.push({ key: "reviews", label: "口コミ", href: `${shopPath}#reviews` });
  return links;
}

export function buildAreaShopCardViewModel(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">,
  options: AreaShopCardViewModelOptions = {}
): AreaShopCardViewModel {
  void targetArea;
  const title = normalizeShopDisplayText(shop.title);
  const shopPath = `/shops/${shop.slug}/`;
  const imageSrc = assetUrl(shop.imageUrl);
  const promotion = shop.ranking.promotion;
  const canShowRank =
    options.showRank === true &&
    Number.isInteger(options.rank) &&
    (options.rank ?? 0) > 0 &&
    !shop.ranking.isPr &&
    promotion?.canReceiveNaturalRankNumber !== false;

  return {
    rank: canShowRank ? (options.rank ?? null) : null,
    image: imageSrc
      ? { src: imageSrc, alt: title, isFallback: false }
      : { src: DEFAULT_SHOP_IMAGE, alt: SHOP_FALLBACK_IMAGE_ALT, isFallback: true },
    title: { text: title, href: shopPath },
    summary: summaryText(shop, options.summarySource ?? "wordpress-only"),
    tags: featureTags(shop),
    facts: facts(shop),
    actions: actions(shop, options.maxActions ?? 2),
    quickLinks: quickLinks(shop, shopPath)
  };
}
