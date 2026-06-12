import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";
import { STATIC_PAGE_SLUGS } from "@/lib/static-pages";
import { getAreas } from "@/lib/wp/areas";
import { getPostsForSitemap } from "@/lib/wp/posts";
import { getShopsForSitemap } from "@/lib/wp/shops";

const FIXED_PAGE_PRIORITY: Record<string, number> = {
  "osaka-nihonbashi": 0.75
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: canonicalUrl("/shops/"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: canonicalUrl("/column/"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...STATIC_PAGE_SLUGS.map((slug) => ({
      url: canonicalUrl(`/${slug}/`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: FIXED_PAGE_PRIORITY[slug] ?? 0.5
    }))
  ];

  let areaRoutes: MetadataRoute.Sitemap = [];
  let shopRoutes: MetadataRoute.Sitemap = [];
  let postRoutes: MetadataRoute.Sitemap = [];

  try {
    const areas = await getAreas();
    areaRoutes = areas.map((area) => ({
      url: canonicalUrl(`/area/${area.slug}/`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: area.parent === 0 ? 0.85 : 0.8
    }));
  } catch {
    areaRoutes = [];
  }

  try {
    const shops = await getShopsForSitemap();
    shopRoutes = shops.map((shop) => ({
      url: canonicalUrl(`/shops/${shop.slug}/`),
      lastModified: shop.modified ? new Date(shop.modified) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7
    }));
  } catch {
    shopRoutes = [];
  }

  try {
    const posts = await getPostsForSitemap();
    postRoutes = posts.map((post) => ({
      url: canonicalUrl(`/column/${post.slug}/`),
      lastModified: post.modified ? new Date(post.modified) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6
    }));
  } catch {
    postRoutes = [];
  }

  return [...staticRoutes, ...areaRoutes, ...shopRoutes, ...postRoutes];
}
