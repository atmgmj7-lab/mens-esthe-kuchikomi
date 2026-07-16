import type { ShopView } from "@/lib/wp/types";
import { normalizePublicShopSlug } from "@/lib/shop-slug";

export type ShopOwnerRequestInitial = {
  shopId: string;
  shopSlug: string;
  shopName: string;
  targetUrl: string;
  source: "shop-detail" | "storelisting";
};

type ShopOwnerRequestQuery = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseShopId(value: string): string {
  if (!/^[1-9]\d*$/.test(value)) return "";
  const shopId = Number(value);
  return Number.isSafeInteger(shopId) ? String(shopId) : "";
}

function parseTargetUrl(value: string, shopSlug: string): string {
  if (!shopSlug) return "";
  const canonicalUrl = `https://mens-esthe-kuchikomi.com/shops/${shopSlug}/`;
  return value === canonicalUrl ? value : "";
}

export function parseShopOwnerRequestInitial(
  query: ShopOwnerRequestQuery,
): ShopOwnerRequestInitial {
  const shopSlug = normalizePublicShopSlug(first(query.shop_slug));

  return {
    shopId: parseShopId(first(query.shop_id)),
    shopSlug,
    shopName: first(query.shop_name).slice(0, 120),
    targetUrl: parseTargetUrl(first(query.target_url), shopSlug),
    source: first(query.source) === "shop-detail" ? "shop-detail" : "storelisting",
  };
}

export function buildShopOwnerRequestUrl(
  shop: Pick<ShopView, "id" | "slug" | "title">,
): string {
  const shopSlug = normalizePublicShopSlug(shop.slug);
  if (!shopSlug) return "/storelisting/#shop-owner-request";

  const params = new URLSearchParams({
    shop_id: String(shop.id),
    shop_slug: shopSlug,
    shop_name: shop.title,
    target_url: `https://mens-esthe-kuchikomi.com/shops/${shopSlug}/`,
    source: "shop-detail",
  });

  return `/storelisting/?${params.toString()}#shop-owner-request`;
}
