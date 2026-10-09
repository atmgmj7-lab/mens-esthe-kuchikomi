export type OperatorShopPublicCache = Readonly<{
  revalidateTag: (tag: string, profile: { expire: 0 }) => void;
  revalidatePath: (path: string) => void;
}>;

/**
 * Keep the managed-facts save path aligned with the established WordPress
 * cache contract. The caller supplies Next's cache APIs so this stays a
 * small, testable declaration of the invalidation scope.
 */
export function revalidateOperatorShopPublicCaches(
  slug: string,
  cache: OperatorShopPublicCache,
): void {
  cache.revalidateTag("wp", { expire: 0 });
  cache.revalidatePath(`/shops/${slug}`);
  cache.revalidatePath("/sitemap.xml");
}

export function revalidateOfficialFactsPublicCaches(
  slug: string,
  cache: OperatorShopPublicCache,
): void {
  revalidateOperatorShopPublicCaches(slug, cache);
}
