import { safeText } from "@/lib/wp/client";
import type { ShopView } from "@/lib/wp/types";

const PRICE_KEYS = [
  "basic_price",
  "price_60",
  "shop_price_60min",
  "price_50",
  "price_70",
  "price_80",
  "price_90"
] as const;

export function isNihonbashiShop(shop: ShopView): boolean {
  if (shop.areaSlug === "nihonbashi") return true;
  return shop.terms.some(
    (t) => t.slug === "nihonbashi" || t.name.includes("日本橋")
  );
}

export function shopAreaLabel(shop: ShopView): string {
  const areaTerm = shop.terms.find((t) => t.parent !== 0) || shop.terms[0];
  return areaTerm?.name || "日本橋";
}

export function shopNearestStation(shop: ShopView): string {
  const address = safeText(shop.acf.shop_address);
  if (address.includes("近鉄日本橋")) return "近鉄日本橋駅周辺";
  if (address.includes("日本橋")) return "日本橋駅周辺";
  if (address.includes("なんば") || address.includes("難波")) return "なんば周辺";
  if (address.includes("谷町九丁目")) return "谷町九丁目駅周辺";
  if (address.includes("堺筋本町")) return "堺筋本町駅周辺";
  return "日本橋・近鉄日本橋周辺";
}

export function extractShopPriceYen(shop: ShopView): number {
  for (const key of PRICE_KEYS) {
    const raw = safeText(shop.acf[key]);
    const num = Number(raw.replace(/[^0-9]/g, ""));
    if (num > 0) return num;
  }
  return 0;
}

export function formatShopPriceLabel(shop: ShopView): string {
  const yen = extractShopPriceYen(shop);
  if (yen > 0) return `${yen.toLocaleString("ja-JP")}円`;
  if (shop.officialUrl) return "公式サイト確認中";
  return "要確認";
}

export function shopHoursText(shop: ShopView): string {
  const hours = safeText(shop.acf.shop_hours);
  return hours || "店舗ページで確認";
}

export function isLateNightShop(shop: ShopView): boolean {
  const hours = safeText(shop.acf.shop_hours);
  if (!hours) return false;
  return /翌|24|深夜|23[:：]|0[:：]/.test(hours);
}

export function isBeginnerFriendlyShop(shop: ShopView): boolean {
  const hours = safeText(shop.acf.shop_hours);
  const hasHours = Boolean(hours);
  const hasOfficial = Boolean(shop.officialUrl);
  const hasCatch = Boolean(safeText(shop.acf.shop_catch, shop.excerpt));
  let score = 0;
  if (hasHours) score += 1;
  if (hasOfficial) score += 1;
  if (hasCatch) score += 1;
  if (extractShopPriceYen(shop) > 0) score += 1;
  return score >= 2;
}

export function isStationNearShop(shop: ShopView): boolean {
  const address = safeText(shop.acf.shop_address);
  const area = shopAreaLabel(shop);
  const haystack = `${address}${area}`;
  return /日本橋|近鉄|なんば|難波|谷町九丁目|堺筋本町/.test(haystack);
}

export function shopFeatureTags(shop: ShopView): string[] {
  const tags: string[] = [];
  if (isLateNightShop(shop)) tags.push("深夜営業");
  if (isStationNearShop(shop)) tags.push("駅近");
  const booking = safeText(shop.acf.shop_booking);
  if (booking.includes("完全予約")) tags.push("完全予約制");
  if (shop.officialUrl) tags.push("公式サイトあり");
  if (tags.length === 0) tags.push("情報確認中");
  return tags.slice(0, 4);
}

export function shopReviewCountLabel(_shop: ShopView): string {
  return "0件";
}

export function buildEditorComment(shop: ShopView): string {
  const area = shopAreaLabel(shop);
  const hours = safeText(shop.acf.shop_hours);
  const parts: string[] = [
    `${area}エリアの${shop.title}について、公開情報・店舗ページ掲載内容をもとに整理した編集部コメントです。`
  ];
  if (hours) {
    parts.push(`営業時間は「${hours}」と掲載されています。`);
  } else {
    parts.push("営業時間は店舗ページまたは公式情報での確認をおすすめします。");
  }
  if (shop.officialUrl) {
    parts.push("公式サイトから予約・問い合わせ導線を確認できます。");
  }
  parts.push("料金やコース内容は変更される場合があるため、来店前に最新情報をご確認ください。");
  return parts.join("");
}

export function resolveLastUpdatedLabel(shops: ShopView[]): string {
  const dates = shops
    .map((s) => safeText(s.acf.shop_updated_at))
    .filter(Boolean);
  if (dates.length === 0) return "2026年6月13日";
  return "2026年6月13日";
}
