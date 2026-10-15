import "server-only";

import { managedShopDirectoryRepository, useSupabaseManagedShopDirectory, type PublishedManagedShop } from "@/lib/supabase/managed-shop-directory";
import { normalizeShopRanking } from "@/lib/shop-ranking";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import type { ShopView } from "@/lib/wp/types";

export class ManagedShopDirectoryUnavailableError extends Error {
  constructor() {
    super("managed shop directory source is unavailable");
    this.name = "ManagedShopDirectoryUnavailableError";
  }
}

export function isManagedShopDirectoryUnavailableError(error: unknown): error is ManagedShopDirectoryUnavailableError {
  return error instanceof ManagedShopDirectoryUnavailableError
    || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "ManagedShopDirectoryUnavailableError");
}

function decode(value: string): string {
  try { return decodeURIComponent(value).toLowerCase(); } catch { return value.toLowerCase(); }
}

function sameSlug(left: string, right: string): boolean { return decode(left) === decode(right); }

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] as string);
}

function publicationImage(publication: PublishedManagedShop): string {
  return publication.banner_asset_id ? `/api/managed-shops/assets/${publication.banner_asset_id}/` : "";
}

function publicationAcf(publication: PublishedManagedShop): Record<string, unknown> {
  return {
    managed_area_name: publication.area_name,
    official_url: publication.official_url,
    shop_address: publication.address,
    shop_hours: publication.business_hours,
    shop_tel: publication.phone,
    shop_line: publication.line_url,
    shop_booking_url: publication.booking_url,
    basic_price: publication.basic_price === null ? null : String(publication.basic_price),
    price_90: publication.price_90 === null ? null : String(publication.price_90),
  };
}

function overlayLegacyShop(shop: ShopView, publication: PublishedManagedShop): ShopView {
  const imageUrl = publicationImage(publication) || shop.imageUrl;
  const primaryArea = shop.primaryArea && shop.primaryArea.slug === publication.area_slug ? shop.primaryArea : null;
  return {
    ...shop,
    title: publication.shop_name,
    contentHtml: publication.introduction === null ? shop.contentHtml : htmlEscape(publication.introduction),
    excerpt: publication.introduction === null ? shop.excerpt : publication.introduction,
    imageUrl,
    media: imageUrl === shop.imageUrl ? shop.media : {
      ...shop.media,
      cardSquare: { mediaId: null, source: "legacy-acf", url: imageUrl, alt: `${publication.shop_name} の掲載画像` },
    },
    acf: { ...shop.acf, ...publicationAcf(publication) },
    officialUrl: publication.official_url ?? shop.officialUrl,
    areaSlug: publication.area_slug,
    primaryArea,
  };
}

function createManagedShop(publication: PublishedManagedShop): ShopView {
  const imageUrl = publicationImage(publication);
  return {
    id: publication.directory_id,
    publicationStatus: "publish",
    slug: publication.shop_slug,
    link: publication.canonical_url,
    title: publication.shop_name,
    contentHtml: publication.introduction === null ? "" : htmlEscape(publication.introduction),
    excerpt: publication.introduction ?? "",
    imageUrl,
    media: { cardSquare: { mediaId: null, source: imageUrl ? "legacy-acf" : "fallback", url: imageUrl, alt: publication.shop_name }, detailBanner: null },
    terms: [],
    acf: publicationAcf(publication),
    officialUrl: publication.official_url ?? "",
    areaSlug: publication.area_slug,
    primaryArea: null,
    ranking: normalizeShopRanking({}),
    strictRanking: unavailableStrictRanking("shop"),
  };
}

/**
 * Composes only approved publications. A legacy record is overlaid only when
 * both immutable WordPress ID and canonical slug match; a mismatch is ignored
 * rather than creating a duplicate or changing public identity.
 */
export function composeManagedShopPublications(
  legacyShops: readonly ShopView[],
  publications: readonly PublishedManagedShop[],
): ShopView[] {
  const byLegacyId = new Map<number, PublishedManagedShop>();
  const newPublications: PublishedManagedShop[] = [];
  for (const publication of publications) {
    if (publication.existing_wp_shop_id === null) newPublications.push(publication);
    else byLegacyId.set(publication.existing_wp_shop_id, publication);
  }
  const composed = legacyShops.map((shop) => {
    const publication = byLegacyId.get(shop.id);
    return publication && sameSlug(shop.slug, publication.shop_slug) ? overlayLegacyShop(shop, publication) : shop;
  });
  const legacyIds = new Set(legacyShops.map((shop) => shop.id));
  for (const publication of newPublications) {
    if (!legacyIds.has(publication.directory_id) && !legacyShops.some((shop) => sameSlug(shop.slug, publication.shop_slug))) {
      composed.push(createManagedShop(publication));
    }
  }
  return composed;
}

export async function getPublishedManagedShopDirectory(): Promise<readonly PublishedManagedShop[]> {
  if (!useSupabaseManagedShopDirectory()) return [];
  if (!managedShopDirectoryRepository.configured()) throw new ManagedShopDirectoryUnavailableError();
  return managedShopDirectoryRepository.listPublished();
}

export async function composeManagedShopDirectory(legacyShops: readonly ShopView[]): Promise<ShopView[]> {
  return composeManagedShopPublications(legacyShops, await getPublishedManagedShopDirectory());
}

export async function findPublishedManagedShopBySlug(slug: string): Promise<ShopView | null> {
  const publications = await getPublishedManagedShopDirectory();
  const publication = publications.find((item) => sameSlug(item.shop_slug, slug));
  return publication && publication.existing_wp_shop_id === null ? createManagedShop(publication) : null;
}
