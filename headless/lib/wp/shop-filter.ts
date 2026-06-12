import { safeText } from "@/lib/wp/client";
import type { ShopView } from "@/lib/wp/types";

export type ShopFilterParams = {
  q?: string;
  area?: string;
  available?: string;
};

export function shopMatchesArea(shop: ShopView, areaSlug: string): boolean {
  if (!areaSlug) return true;
  const slug = areaSlug.toLowerCase();
  return shop.terms.some((term) => term.slug.toLowerCase() === slug);
}

export function shopIsAvailable(shop: ShopView): boolean {
  const availability = safeText(shop.acf.shop_availability);
  const todayAnalysis = safeText(shop.acf.shop_today_analysis);
  return availability === "出勤中" || Boolean(todayAnalysis);
}

function shopSearchHaystack(shop: ShopView): string {
  const priceKeys = [
    "basic_price",
    "price_50",
    "price_60",
    "price_70",
    "price_80",
    "price_90",
    "price_120",
    "price_150",
    "shop_price_60min"
  ] as const;

  const parts = [
    shop.title,
    safeText(shop.acf.shop_catch),
    shop.excerpt,
    ...shop.terms.map((term) => term.name),
    safeText(shop.acf.shop_hours),
    safeText(shop.acf.basic_time),
    ...priceKeys.map((key) => safeText(shop.acf[key]))
  ];

  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function filterShops(shops: ShopView[], params: ShopFilterParams): ShopView[] {
  const q = params.q?.trim().toLowerCase() ?? "";
  const area = params.area?.trim().toLowerCase() ?? "";
  const availableOnly = params.available === "1";

  return shops.filter((shop) => {
    if (area && !shopMatchesArea(shop, area)) return false;
    if (availableOnly && !shopIsAvailable(shop)) return false;
    if (q && !shopSearchHaystack(shop).includes(q)) return false;
    return true;
  });
}

export function hasActiveShopFilters(params: ShopFilterParams): boolean {
  return Boolean(params.q?.trim() || params.area?.trim() || params.available === "1");
}
