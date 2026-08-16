import "server-only";

import type { AreaView, ShopView } from "@/lib/wp/types";

export type ShopDetailAreaContext = {
  area: AreaView | null;
  parent: AreaView | null;
};

export function resolveShopDetailAreaContext(
  shop: ShopView,
  allAreas: AreaView[],
): ShopDetailAreaContext {
  const explicit = shop.primaryArea;
  if (!explicit) return { area: null, parent: null };

  const area = allAreas.find(
    (candidate) => candidate.id === explicit.id && candidate.slug === explicit.slug,
  ) ?? null;
  if (!area) return { area: null, parent: null };

  const parent = area.parent > 0
    ? allAreas.find((candidate) => candidate.id === area.parent) ?? null
    : null;
  return { area, parent };
}
