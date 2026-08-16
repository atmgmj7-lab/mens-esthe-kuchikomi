import Link from "next/link";
import { PRIORITY_AREAS } from "@/lib/priority-areas";

export function PriorityAreaLinks({
  heading = "重点エリアから探す",
  compact = false,
}: {
  heading?: string;
  compact?: boolean;
}) {
  return (
    <section className={`escomi-priority-areas${compact ? " escomi-priority-areas--compact" : ""}`} aria-labelledby="priority-area-links-heading">
      <div className="escomi-home-container-v2">
        <div className="escomi-home-section-head-v2">
          <p className="escomi-section-eyebrow">PRIORITY AREA GUIDE</p>
          <h2 id="priority-area-links-heading">{heading}</h2>
          <p>口コミと店舗情報を確認しながら、関西の主要エリアを比較できます。</p>
        </div>
        <div className="escomi-priority-areas__grid">
          {PRIORITY_AREAS.map((area) => (
            <Link href={`/area/${area.slug}/`} key={area.slug}>
              <strong>{area.name}</strong>
              <span>{area.name}のメンズエステを探す</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
