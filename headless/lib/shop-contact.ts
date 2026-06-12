import { safeText } from "@/lib/wp/client";
import type { ShopView } from "@/lib/wp/types";

export function shopField(shop: ShopView, key: string, fallback = "") {
  return safeText(shop.acf[key], fallback);
}

export function phoneHref(phone: string) {
  const normalized = phone.replace(/[^0-9]/g, "");
  return normalized ? `tel:${normalized}` : "#";
}

/** _embed の parent 欠落時も shop.areaSlug を最優先して細エリアを解決する */
export function resolveShopAreaTerm(shop: ShopView) {
  if (shop.areaSlug) {
    const matched = shop.terms.find((term) => term.slug === shop.areaSlug);
    if (matched) return matched;
  }
  if (shop.terms.length > 0) {
    return shop.terms[shop.terms.length - 1];
  }
  const childArea = shop.terms.find((term) => term.parent !== 0);
  if (childArea) return childArea;
  return shop.terms.find((term) => term.parent === 0);
}

export function shopContactLinks(shop: ShopView) {
  const tel = shopField(shop, "shop_tel");
  const line = shopField(shop, "shop_line");
  const officialUrl = shop.officialUrl || shopField(shop, "official_url");

  const areaTerm = resolveShopAreaTerm(shop);
  const areaSlug = shop.areaSlug || areaTerm?.slug || "";
  const areaName = areaTerm?.name ?? (shop.areaSlug || "エリア");
  const areaPageUrl = areaSlug ? `/area/${areaSlug}/` : null;
  const areaShopsUrl = areaSlug ? `/shops/?area=${encodeURIComponent(areaSlug)}` : null;

  return { tel, line, officialUrl, areaName, areaPageUrl, areaShopsUrl };
}
