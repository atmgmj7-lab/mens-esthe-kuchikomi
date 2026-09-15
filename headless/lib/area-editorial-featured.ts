import "server-only";
import type { AreaView, ShopView } from "@/lib/wp/types";

export type AreaEditorialFeatureConfig = Readonly<{
  areaId: number;
  areaSlug: string;
  featuredShopIds: readonly number[];
  label: string;
  description: string;
  enabled: boolean;
}>;

export const AREA_EDITORIAL_FEATURES: Readonly<Record<string, AreaEditorialFeatureConfig>> = {
  shinosaka: {
    areaId: 13,
    areaSlug: "shinosaka",
    featuredShopIds: [712, 768],
    label: "編集部ピックアップ",
    description: "エスコミ編集部が選んだ店舗です。掲載順はランキングではありません。",
    enabled: true,
  },
};

/** Editorial shortcuts only. Never alter the natural list or infer a shop from its name. */
export function buildAreaEditorialFeature(
  area: Pick<AreaView, "id" | "slug">,
  publicShops: readonly ShopView[],
): { config: AreaEditorialFeatureConfig; shops: ShopView[] } | null {
  const config = AREA_EDITORIAL_FEATURES[area.slug];
  if (!config?.enabled || config.areaId !== area.id || config.areaSlug !== area.slug) return null;
  const shops = [...new Set(config.featuredShopIds)].flatMap((id) => {
    const matches = publicShops.filter((shop) => shop.id === id);
    if (matches.length !== 1) return [];
    const shop = matches[0];
    if (shop.publicationStatus !== "publish" || !shop.terms.some((term) =>
      term.id === area.id && (term.taxonomy === "area" || term.taxonomy === undefined))) return [];
    try {
      const slug = decodeURIComponent(shop.slug);
      if (!slug || slug === "." || slug === ".." || /[/?#\\\s\u0000-\u001f\u007f]/u.test(slug)) return [];
    } catch { return []; }
    return [shop];
  });
  return shops.length ? { config, shops } : null;
}
