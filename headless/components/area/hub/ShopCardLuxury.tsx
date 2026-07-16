"use client";

import { AreaShopCard } from "@/components/common/AreaShopCard";
import type { AreaView, ShopView } from "@/lib/wp/types";

type ShopCardLuxuryProps = {
  shop: ShopView;
  targetArea: Pick<AreaView, "slug" | "name">;
  rank?: number | null;
};

export function ShopCardLuxury({
  shop,
  targetArea,
  rank = null
}: ShopCardLuxuryProps) {
  return (
    <AreaShopCard
      shop={shop}
      targetArea={targetArea}
      rank={rank}
      showRank={Boolean(rank)}
    />
  );
}
