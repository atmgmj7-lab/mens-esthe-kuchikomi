import { resolveRatingDisplay } from "@/lib/area-shop-utils";
import type { ShopView } from "@/lib/wp/types";

const KIND_CLASS = {
  user_reviews: "rating-badge--reviews",
  editor_score: "rating-badge--editor",
  pending: "rating-badge--pending"
} as const;

export function RatingBadge({
  shop,
  className = "",
  showValue = true
}: {
  shop: ShopView;
  className?: string;
  showValue?: boolean;
}) {
  const rating = resolveRatingDisplay(shop);

  return (
    <div className={`rating-badge ${KIND_CLASS[rating.kind]} ${className}`.trim()}>
      <span className="rating-badge__label">{rating.label}</span>
      {showValue && rating.value ? (
        <span className="rating-badge__value">{rating.value}</span>
      ) : null}
      {rating.kind === "user_reviews" && rating.count != null ? (
        <span className="rating-badge__count">（{rating.count}件）</span>
      ) : null}
    </div>
  );
}
