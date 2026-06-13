import { resolvePriceDisplay, type PriceDisplayStatus } from "@/lib/area-shop-utils";
import type { ShopView } from "@/lib/wp/types";

const STATUS_CLASS: Record<PriceDisplayStatus, string> = {
  available: "price-label--available",
  unknown: "price-label--unknown",
  official_checking: "price-label--official",
  shop_page_check: "price-label--shop-page",
  not_listed: "price-label--not-listed"
};

export function PriceLabel({
  shop,
  className = ""
}: {
  shop: ShopView;
  className?: string;
}) {
  const display = resolvePriceDisplay(shop);

  return (
    <span className={`price-label ${STATUS_CLASS[display.status]} ${className}`.trim()}>
      {display.label}
    </span>
  );
}
