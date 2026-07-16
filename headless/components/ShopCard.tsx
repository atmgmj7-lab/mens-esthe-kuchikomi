import { AreaShopCard } from "@/components/common/AreaShopCard";
import type { AreaView, ShopView } from "@/lib/wp/types";

type ShopCardProps = {
  shop: ShopView;
  compact?: boolean;
  variant?: "default" | "new";
  rank?: number | null;
};

function targetAreaForShop(shop: ShopView): Pick<AreaView, "slug" | "name"> {
  const area = shop.terms.find((term) => term.parent !== 0) ?? shop.terms[0];
  return {
    slug: area?.slug ?? shop.areaSlug,
    name: area?.name ?? ""
  };
}

export function ShopCard({ shop, rank = null }: ShopCardProps) {
  return (
    <AreaShopCard
      shop={shop}
      targetArea={targetAreaForShop(shop)}
      rank={rank}
      showRank={Boolean(rank)}
    />
  );
}
