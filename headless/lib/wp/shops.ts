import { createHash } from "crypto";
import { wpFetch, wpFetchPaginated } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeShop } from "@/lib/wp/normalize";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import type { ShopView, WpShop } from "@/lib/wp/types";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function slugsMatch(a: string, b: string): boolean {
  return safeDecodeURIComponent(a).toLowerCase() === safeDecodeURIComponent(b).toLowerCase();
}

function shopSlugCacheTag(slug: string): string {
  const normalized = safeDecodeURIComponent(slug).toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `shop:h:${hash}`;
}

function getSlugQueryVariants(slug: string): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    if (!seen.has(value)) {
      seen.add(value);
      variants.push(value);
    }
  };

  add(encodeURIComponent(slug));

  if (slug.includes("%")) {
    add(slug);
    const decoded = safeDecodeURIComponent(slug);
    if (decoded !== slug) {
      add(encodeURIComponent(decoded));
    }
  }

  return variants;
}

async function findShopViaSearchOrListing(slug: string): Promise<WpShop | null> {
  const needle = slug.toLowerCase();
  const searchResults = await wpFetch<WpShop[]>(
    `/wp/v2/shop?search=${encodeURIComponent(slug)}&per_page=100&_embed=1`
  );

  const exactMatch = searchResults.find((shop) => slugsMatch(shop.slug, slug));
  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = searchResults.find((shop) => {
    const shopSlug = shop.slug.toLowerCase();
    const title = (shop.title?.rendered ?? "").toLowerCase();
    return shopSlug.includes(needle) || title.includes(needle);
  });
  if (partialMatch) {
    return partialMatch;
  }

  const perPage = 100;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data, pagination } = await wpFetchPaginated<WpShop[]>(
      `/wp/v2/shop?per_page=${perPage}&page=${page}&_embed=1`
    );
    const listingMatch = data.find((shop) => slugsMatch(shop.slug, slug));
    if (listingMatch) {
      return listingMatch;
    }
    totalPages = pagination.totalPages;
    page += 1;
  }

  return null;
}

export async function getLatestShops(limit = 6): Promise<ShopView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", `shops:list:${limit}`);
  try {
    const shops = await wpFetch<WpShop[]>(`/wp/v2/shop?per_page=${limit}&_embed=1`);
    return shops.map(normalizeShop);
  } catch (error) {
    logWpBuildFallback(`latest shops ${limit}`, error);
    return [];
  }
}

export async function getShopBySlug(slug: string): Promise<ShopView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "shops", shopSlugCacheTag(slug));

  try {
    for (const variant of getSlugQueryVariants(slug)) {
      const shops = await wpFetch<WpShop[]>(`/wp/v2/shop?slug=${variant}&_embed=1`);
      if (shops[0]) {
        return normalizeShop(shops[0]);
      }
    }

    const match = await findShopViaSearchOrListing(slug);
    if (!match) {
      return null;
    }

    cacheTag("wp", "shops", shopSlugCacheTag(match.slug));
    return normalizeShop(match);
  } catch (error) {
    logWpBuildFallback(`shop ${slug}`, error);
    return null;
  }
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

  try {
    while (page <= totalPages) {
      const { data, pagination } = await wpFetchPaginated<WpShop[]>(
        `/wp/v2/shop?per_page=${perPage}&page=${page}&orderby=modified&order=desc&_fields=slug,modified`
      );
      entries.push(...data.map((shop) => ({ slug: shop.slug, modified: shop.modified })));
      totalPages = pagination.totalPages;
      page += 1;
    }
  } catch (error) {
    logWpBuildFallback("shops sitemap", error);
  }

  return entries;
}

export async function getAllShopsForListing(maxShops = 500): Promise<ShopView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", "shops:listing-all");

  const perPage = 100;
  const shops: ShopView[] = [];
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages && shops.length < maxShops) {
      const { data, pagination } = await wpFetchPaginated<WpShop[]>(
        `/wp/v2/shop?per_page=${perPage}&page=${page}&orderby=modified&order=desc&_embed=1`
      );
      shops.push(...data.map(normalizeShop));
      totalPages = pagination.totalPages;
      page += 1;
    }
  } catch (error) {
    logWpBuildFallback(`shops listing ${maxShops}`, error);
  }

  return shops.slice(0, maxShops);
}

export async function getShopCount(): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", "shops:count");
  try {
    const { pagination } = await wpFetchPaginated<WpShop[]>("/wp/v2/shop?per_page=1");
    return pagination.total;
  } catch (error) {
    logWpBuildFallback("shop count", error);
    return 0;
  }
}
