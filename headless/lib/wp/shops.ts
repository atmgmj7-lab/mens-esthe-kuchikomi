import { createHash } from "crypto";
import { wpFetch, wpFetchPaginated } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeShop } from "@/lib/wp/normalize";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import { applyManagedShopFactsToList, isManagedShopSourceUnavailableError } from "@/lib/shop-management-source";
import { composeManagedShopDirectory, findPublishedManagedShopBySlug, getPublishedManagedShopDirectory, isManagedShopDirectoryUnavailableError } from "@/lib/managed-shop-source";
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

function shopIdCacheTag(id: number): string {
  return `shop:id:${id}`;
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

async function applyPublicShopSources(shops: readonly ShopView[], includeNew = false): Promise<ShopView[]> {
  const composed = await composeManagedShopDirectory(shops);
  const legacyIds = new Set(shops.map((shop) => shop.id));
  return applyManagedShopFactsToList(includeNew ? composed : composed.filter((shop) => legacyIds.has(shop.id)));
}

async function applyPublicShopSource(shop: ShopView): Promise<ShopView | null> {
  const composed = await applyPublicShopSources([shop]);
  return composed[0] ?? null;
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
    return applyPublicShopSources(shops.map(normalizeShop));
  } catch (error) {
    if (isManagedShopSourceUnavailableError(error) || isManagedShopDirectoryUnavailableError(error)) throw error;
    logWpBuildFallback(`latest shops ${limit}`, error);
    return [];
  }
}

export async function getShopBySlug(slug: string): Promise<ShopView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "shops", shopSlugCacheTag(slug));

  const managedOnly = await findPublishedManagedShopBySlug(slug);
  if (managedOnly) return managedOnly;
  try {
    for (const variant of getSlugQueryVariants(slug)) {
      const shops = await wpFetch<WpShop[]>(`/wp/v2/shop?slug=${variant}&_embed=1`);
      if (shops[0]) {
        return applyPublicShopSource(normalizeShop(shops[0]));
      }
    }

    const match = await findShopViaSearchOrListing(slug);
    if (!match) return findPublishedManagedShopBySlug(slug);

    cacheTag("wp", "shops", shopSlugCacheTag(match.slug));
    return applyPublicShopSource(normalizeShop(match));
  } catch (error) {
    if (isManagedShopSourceUnavailableError(error) || isManagedShopDirectoryUnavailableError(error)) throw error;
    logWpBuildFallback(`shop ${slug}`, error);
    return null;
  }
}

export async function getShopById(id: number): Promise<ShopView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "shops", shopIdCacheTag(id));

  const shop = await getWordPressShopById(id);
  return shop ? applyPublicShopSource(shop) : null;
}

/** Server-only management bootstrap reader. It never applies the public source overlay. */
export async function getWordPressShopById(id: number): Promise<ShopView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "shops", shopIdCacheTag(id), "shops:management-bootstrap");

  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    const shop = await wpFetch<WpShop>(`/wp/v2/shop/${id}?_embed=1`);
    return shop.id === id ? normalizeShop(shop) : null;
  } catch (error) {
    if (isManagedShopSourceUnavailableError(error) || isManagedShopDirectoryUnavailableError(error)) throw error;
    logWpBuildFallback(`shop id ${id}`, error);
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

  const publications = await getPublishedManagedShopDirectory();
  const publishedNewShops = publications
    .filter((publication) => publication.existing_wp_shop_id === null)
    .map((publication) => ({ slug: publication.shop_slug, modified: new Date().toISOString() }));
  const existingSlugs = new Set(entries.map((entry) => entry.slug.toLowerCase()));
  return [...entries, ...publishedNewShops.filter((entry) => !existingSlugs.has(entry.slug.toLowerCase()))];
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
    if (isManagedShopSourceUnavailableError(error) || isManagedShopDirectoryUnavailableError(error)) throw error;
    logWpBuildFallback(`shops listing ${maxShops}`, error);
  }

  return applyPublicShopSources(shops.slice(0, maxShops), true);
}

export async function getShopCount(): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", "shops:count");
  try {
    const { pagination } = await wpFetchPaginated<WpShop[]>("/wp/v2/shop?per_page=1");
    const publications = await getPublishedManagedShopDirectory();
    return pagination.total + publications.filter((publication) => publication.existing_wp_shop_id === null).length;
  } catch (error) {
    logWpBuildFallback("shop count", error);
    return 0;
  }
}
