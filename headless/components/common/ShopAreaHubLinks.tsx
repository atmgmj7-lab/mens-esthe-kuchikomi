import Link from "next/link";
import { resolveAreaHubContext } from "@/lib/area-shop-utils";
import type { AreaView } from "@/lib/wp/types";

export function ShopAreaHubLinks({
  area,
  parentArea
}: {
  area: AreaView;
  parentArea?: AreaView | null;
}) {
  const hubContext = resolveAreaHubContext(area, parentArea);
  const areaPath = `/area/${area.slug}/`;

  return (
    <section className="area-shop-links hl-section">
      <h2 className="sec-title-simple shop-sec-title">
        <span className="en">AREA</span>
        <span className="ja">{hubContext.name}エリアの関連ページ</span>
      </h2>
      <div className="area-shop-links__box">
        <Link href={areaPath} className="area-shop-links__item">
          {hubContext.shopLinks.listLink}
        </Link>
        <Link href={`${areaPath}#shop-list`} className="area-shop-links__item">
          {hubContext.shopLinks.compareLink}
        </Link>
        <Link href={`${areaPath}#ranking`} className="area-shop-links__item">
          {hubContext.name}メンズエステおすすめランキングへ
        </Link>
        <Link href={`${areaPath}#price-table`} className="area-shop-links__item">
          {hubContext.shopLinks.priceLink}
        </Link>
        <Link href={`${areaPath}#station`} className="area-shop-links__item">
          {hubContext.shopLinks.stationLink}
        </Link>
        <Link href={`${areaPath}#reviews`} className="area-shop-links__item">
          {hubContext.name}のユーザー口コミへ
        </Link>
        {hubContext.guidePath ? (
          <Link href={hubContext.guidePath} className="area-shop-links__item">
            {hubContext.name}で失敗しない選び方ガイド
          </Link>
        ) : null}
      </div>
    </section>
  );
}
