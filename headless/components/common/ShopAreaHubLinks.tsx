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
          {area.slug === "nihonbashi"
            ? "大阪日本橋メンズエステの店舗一覧へ"
            : `${hubContext.name}メンズエステの店舗一覧へ`}
        </Link>
        <Link href={`${areaPath}#shop-list`} className="area-shop-links__item">
          {area.slug === "nihonbashi"
            ? "日本橋メンズエステ店舗一覧（口コミ・料金比較）"
            : `${hubContext.name}の店舗一覧で比較する`}
        </Link>
        <Link href={`${areaPath}#ranking`} className="area-shop-links__item">
          {hubContext.name}メンズエステおすすめランキングへ
        </Link>
        <Link href={`${areaPath}#price-table`} className="area-shop-links__item">
          {area.slug === "nihonbashi"
            ? "日本橋メンズエステ料金比較表へ"
            : `${hubContext.name}の料金比較表へ`}
        </Link>
        <Link href={`${areaPath}#station`} className="area-shop-links__item">
          {area.slug === "nihonbashi"
            ? "駅近の日本橋メンズエステ一覧へ"
            : `駅近の${hubContext.name}メンズエステ一覧へ`}
        </Link>
        <Link href={`${areaPath}#reviews`} className="area-shop-links__item">
          {hubContext.name}の口コミ・編集部レビューへ
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
