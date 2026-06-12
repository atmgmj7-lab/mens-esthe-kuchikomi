import { wpFetch, wpFetchPaginated } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeShop } from "@/lib/wp/normalize";
import type { ShopView, WpShop } from "@/lib/wp/types";

export async function getLatestShops(limit = 6): Promise<ShopView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", `shops:list:${limit}`);
  const shops = await wpFetch<WpShop[]>(`/wp/v2/shop?per_page=${limit}&_embed=1`);
  return shops.map(normalizeShop);
}

export async function getShopBySlug(slug: string): Promise<ShopView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "shops", `shop:${slug}`);
  const shops = await wpFetch<WpShop[]>(`/wp/v2/shop?slug=${encodeURIComponent(slug)}&_embed=1`);
  if (shops[0]) {
    return normalizeShop(shops[0]);
  }

  const needle = slug.toLowerCase();
  const searchResults = await wpFetch<WpShop[]>(
    `/wp/v2/shop?search=${encodeURIComponent(slug)}&per_page=10&_embed=1`
  );
  const match = searchResults.find((shop) => {
    const shopSlug = shop.slug.toLowerCase();
    const title = (shop.title?.rendered ?? "").toLowerCase();
    return shopSlug.includes(needle) || title.includes(needle);
  });

  if (!match) {
    return null;
  }

  cacheTag("wp", "shops", `shop:${match.slug}`);
  return normalizeShop(match);
}

export type SitemapEntry = {
  slug: string;
  modified: string;
};

export async function getShopsForSitemap(): Promise<SitemapEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "shops", "shops:sitemap");

  const perPage = 100;
  const entries: SitemapEntry[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data, pagination } = await wpFetchPaginated<WpShop[]>(
      `/wp/v2/shop?per_page=${perPage}&page=${page}&orderby=modified&order=desc&_fields=slug,modified`
    );
    entries.push(...data.map((shop) => ({ slug: shop.slug, modified: shop.modified })));
    totalPages = pagination.totalPages;
    page += 1;
  }

  return entries;
}

export async function getShopCount(): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", "shops:count");
  try {
    const { pagination } = await wpFetchPaginated<WpShop[]>("/wp/v2/shop?per_page=1");
    return pagination.total;
  } catch {
    return 0;
  }
}
