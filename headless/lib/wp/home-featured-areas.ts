import { AREA_FEATURES, type AreaFeatureItem } from "@/lib/design-constants";
import { safeText, wpFetch } from "@/lib/wp/client";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import { cacheLife, cacheTag } from "next/cache";

type WpHomeFeaturedArea = Partial<AreaFeatureItem> & {
  enabled?: boolean;
};

const FALLBACK_FEATURES = AREA_FEATURES.map((feature) => ({ ...feature }));

function fallbackForSlug(slug: string): AreaFeatureItem | undefined {
  return FALLBACK_FEATURES.find((feature) => feature.slug === slug);
}

function normalizeFeature(raw: WpHomeFeaturedArea): AreaFeatureItem | null {
  const slug = safeText(raw.slug).trim();
  if (!slug) return null;

  const fallback = fallbackForSlug(slug);
  const title = safeText(raw.title, fallback?.title || "").trim();
  if (!title) return null;

  return {
    slug,
    href: safeText(raw.href, fallback?.href || `/area/${slug}/`).trim() || `/area/${slug}/`,
    subtitle: safeText(raw.subtitle, fallback?.subtitle || `${title}特集`).trim(),
    title,
    description: safeText(raw.description, fallback?.description || "").trim(),
    btnText: safeText(raw.btnText, fallback?.btnText || `${title}を見る`).trim(),
    image: safeText(raw.image, fallback?.image || "").trim(),
    imageAlt: safeText(raw.imageAlt, fallback?.imageAlt || `${title}のイメージ`).trim()
  };
}

export async function getHomeFeaturedAreas(): Promise<AreaFeatureItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "home", "home:featured-areas");

  try {
    const response = await wpFetch<{ items?: WpHomeFeaturedArea[] }>("/escomi/v1/home-featured-areas");
    const features = (response.items || [])
      .filter((item) => item.enabled !== false)
      .map(normalizeFeature)
      .filter((item): item is AreaFeatureItem => Boolean(item));

    return features.length > 0 ? features : FALLBACK_FEATURES;
  } catch (error) {
    logWpBuildFallback("home featured areas", error);
    return FALLBACK_FEATURES;
  }
}
