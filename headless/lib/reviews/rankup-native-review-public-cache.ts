export type RankUpNativeReviewPublicCache = Readonly<{
  revalidateTag: (tag: string, profile: { expire: 0 }) => void;
  revalidatePath: (path: string, type?: "page" | "layout") => void;
}>;

/** Revalidate every public surface that consumes the one-store native review feed. */
export function revalidateRankUpNativeReviewPublicCaches(
  slug: string,
  cache: RankUpNativeReviewPublicCache,
): void {
  cache.revalidateTag("reviews:native", { expire: 0 });
  cache.revalidateTag("reviews:native:768", { expire: 0 });
  cache.revalidatePath(`/shops/${slug}`);
  cache.revalidatePath(`/shops/${slug}/reviews`);
  cache.revalidatePath("/");
  cache.revalidatePath("/reviews");
  cache.revalidatePath("/area/[slug]", "page");
}
