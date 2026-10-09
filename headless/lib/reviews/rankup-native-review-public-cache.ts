export type RankUpNativeReviewPublicCache = Readonly<{
  revalidatePath: (path: string, type?: "page" | "layout") => void;
}>;

/** Revalidate every public surface that consumes the one-store native review feed. */
export function revalidateRankUpNativeReviewPublicCaches(
  slug: string,
  cache: RankUpNativeReviewPublicCache,
): void {
  cache.revalidatePath(`/shops/${slug}`);
  cache.revalidatePath(`/shops/${slug}/reviews`);
  cache.revalidatePath("/");
  cache.revalidatePath("/reviews");
  cache.revalidatePath("/area/[slug]", "page");
}
