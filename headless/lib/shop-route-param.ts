import { normalizePublicShopSlug } from "@/lib/shop-slug";

export function toShopRouteParam(slug: string): string {
  const canonicalSlug = normalizePublicShopSlug(slug);
  if (!canonicalSlug) return "";

  try {
    return decodeURIComponent(canonicalSlug);
  } catch {
    return "";
  }
}
