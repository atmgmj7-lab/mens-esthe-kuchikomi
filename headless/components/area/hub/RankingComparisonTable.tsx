import Link from "next/link";
import { ShopImageThumb } from "@/components/area/hub/ShopImageThumb";
import { PriceLabel } from "@/components/common/PriceLabel";
import { shopHoursText, shopNearestStation, shopReviewCountLabel } from "@/lib/area-shop-utils";
import type { ShopView } from "@/lib/wp/types";

export function RankingComparisonTable({ shops }: { shops: ShopView[] }) {
  return (
    <div className="ranking-comparison-table-wrap">
      <div className="ranking-comparison-table" role="table" aria-label="店舗比較">
        <div className="ranking-comparison-table__header" role="row">
          <span role="columnheader">店舗</span>
          <span role="columnheader">60分目安</span>
          <span role="columnheader">営業時間</span>
          <span role="columnheader">駅・徒歩案内</span>
          <span role="columnheader">口コミ</span>
        </div>
        <div className="ranking-comparison-table__body" role="rowgroup">
          {shops.map((shop) => {
            const station = shopNearestStation(shop);
            return (
              <div className="ranking-comparison-table__row" role="row" data-comparison-row key={shop.id}>
                <div className="ranking-comparison-table__cell ranking-comparison-table__shop" role="cell">
                  <span className="ranking-comparison-table__cell-label">店舗</span>
                  <Link href={`/shops/${shop.slug}/`} className="ranking-comparison-table__shop-link">
                    <ShopImageThumb src={shop.imageUrl} alt="" size="table" className="ranking-comparison-table__thumb" />
                    <span>{shop.title}</span>
                  </Link>
                </div>
                <div className="ranking-comparison-table__cell ranking-comparison-table__price" role="cell">
                  <span className="ranking-comparison-table__cell-label">60分目安</span>
                  <PriceLabel shop={shop} />
                </div>
                <div className="ranking-comparison-table__cell" role="cell">
                  <span className="ranking-comparison-table__cell-label">営業時間</span>
                  <span>{shopHoursText(shop)}</span>
                </div>
                <div className="ranking-comparison-table__cell" role="cell">
                  <span className="ranking-comparison-table__cell-label">駅・徒歩案内</span>
                  {station ? <span>{station}</span> : null}
                </div>
                <div className="ranking-comparison-table__cell" role="cell">
                  <span className="ranking-comparison-table__cell-label">口コミ</span>
                  <span>{shopReviewCountLabel(shop)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
