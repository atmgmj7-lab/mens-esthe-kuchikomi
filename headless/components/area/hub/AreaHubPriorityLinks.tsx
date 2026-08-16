import Link from "next/link";
import { buildAreaReviewSubmitUrl } from "@/lib/review-links";
import type { AreaHubContext } from "@/lib/area-shop-utils";

export function AreaHubPriorityLinks({
  hubContext,
}: {
  hubContext: Pick<AreaHubContext, "slug" | "name" | "nearbyAreas">;
}) {
  return (
    <section
      id="area-discovery-links"
      className="area-hub-priority-links"
      aria-labelledby="area-discovery-links-title"
    >
      <header className="area-hub-priority-links__header">
        <p className="area-hub-priority-links__eyebrow">NEXT GUIDE</p>
        <h2 id="area-discovery-links-title">{hubContext.name}から次に探す</h2>
      </header>

      <div className="area-hub-priority-links__grid">
        <Link href="/" className="area-hub-priority-links__card">
          <strong>エスコミのトップへ</strong>
          <span>関西のエリアや店舗を探す</span>
        </Link>
        <Link href="/reviews/" className="area-hub-priority-links__card">
          <strong>{hubContext.name}の口コミをもっと見る</strong>
          <span>口コミ・体験Hubで探す</span>
        </Link>
        <Link
          href={buildAreaReviewSubmitUrl(hubContext.slug)}
          className="area-hub-priority-links__card area-hub-priority-links__card--accent"
        >
          <strong>{hubContext.name}の口コミを書く</strong>
          <span>このエリアを選んだ状態で投稿へ進む</span>
        </Link>
        {hubContext.nearbyAreas.map((area) => (
          <Link
            key={area.slug}
            href={`/area/${area.slug}/`}
            className="area-hub-priority-links__card"
          >
            <strong>{area.label}</strong>
            <span>近隣エリアの店舗を比較する</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
