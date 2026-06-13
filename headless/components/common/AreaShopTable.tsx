import Link from "next/link";
import { PriceLabel } from "@/components/common/PriceLabel";
import { shopHoursText, shopNearestStation, shopReviewCountLabel } from "@/lib/area-shop-utils";
import type { ShopView } from "@/lib/wp/types";

export function AreaShopTable({ shops }: { shops: ShopView[] }) {
  return (
    <div className="area-table-wrap">
      <table className="area-table">
        <thead>
          <tr>
            <th>店舗名</th>
            <th>60分目安</th>
            <th>営業時間</th>
            <th>最寄駅</th>
            <th>口コミ</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.id}>
              <td>
                <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
              </td>
              <td>
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
