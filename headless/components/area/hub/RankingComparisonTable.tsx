import Link from "next/link";
import { ShopImageThumb } from "@/components/area/hub/ShopImageThumb";
import { PriceLabel } from "@/components/common/PriceLabel";
import { shopHoursText, shopNearestStation, shopReviewCountLabel } from "@/lib/area-shop-utils";
import type { ShopView } from "@/lib/wp/types";

export function RankingComparisonTable({ shops }: { shops: ShopView[] }) {
  return (
    <div className="ranking-comparison-table-wrap">
      <table className="ranking-comparison-table">
        <thead>
          <tr>
            <th scope="col">店舗</th>
            <th scope="col">60分目安</th>
            <th scope="col">営業時間</th>
            <th scope="col">最寄駅</th>
            <th scope="col">口コミ</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.id}>
              <td className="ranking-comparison-table__shop">
                <Link href={`/shops/${shop.slug}/`} className="ranking-comparison-table__shop-link">
                  <ShopImageThumb src={shop.imageUrl} alt="" size="table" className="ranking-comparison-table__thumb" />
                  <span>{shop.title}</span>
                </Link>
              </td>
              <td className="ranking-comparison-table__price">
                <PriceLabel shop={shop} />
              </td>
              <td>{shopHoursText(shop)}</td>
              <td>{shopNearestStation(shop)}</td>
              <td>{shopReviewCountLabel(shop)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
