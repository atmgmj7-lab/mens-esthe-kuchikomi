import { normalizePublicShopSlug } from "@/lib/shop-slug";

type ReviewSubmitShop = Readonly<{
  id: number;
  slug: string;
  publicationStatus?: string;
}>;

export function resolveReviewSubmitPrefill<T extends ReviewSubmitShop>(
  rawShop: string | string[] | undefined,
  shops: readonly T[],
): T | null {
  if (typeof rawShop !== "string") return null;
  const slug = normalizePublicShopSlug(rawShop);
  if (!slug) return null;

  return shops.find((shop) => (
    shop.publicationStatus === "publish"
    && normalizePublicShopSlug(shop.slug) === slug
  )) ?? null;
}
