import Link from "next/link";
import { KANSAI_AREAS, KANSAI_TILE_IMAGES } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";
import { SectionTitle } from "@/components/SectionTitle";

export function KansaiAreaGrid({ areas }: { areas: AreaView[] }) {
  const countBySlug = Object.fromEntries(areas.map((a) => [a.slug, a.count]));

  const row1 = KANSAI_AREAS.slice(0, 3);
  const row2 = KANSAI_AREAS.slice(3, 6);

  return (
    <section className="mep-area-section hl-fade-in">
      <div className="mep-container">
        <SectionTitle jp="人気エリアから探す" center />
        <div className="sooon-wrapper">
          <div className="sooon-row">
            {row1.map((item) => (
              <AreaTile key={item.slug} item={item} count={countBySlug[item.slug] ?? 0} />
            ))}
          </div>
          <div className="sooon-row">
            {row2.map((item) => (
              <AreaTile key={item.slug} item={item} count={countBySlug[item.slug] ?? 0} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AreaTile({
  item,
  count
}: {
  item: (typeof KANSAI_AREAS)[number];
  count: number;
}) {
  const bgStyle = {
    backgroundImage: `url(${KANSAI_TILE_IMAGES[item.slug]})`
  };

  return (
    <Link
      href={`/area/${item.slug}/`}
      className={`sooon-item bg-${item.slug} hl-card-hover`}
      style={bgStyle}
    >
      <div className="sooon-overlay" />
      <div className="sooon-content">
        <p className="sooon-en">{item.en}</p>
        <h2 className="sooon-title">{item.name}</h2>
        <p className="sooon-sub">{item.sub}</p>
        <div className="sooon-view-more">
          <span>View more</span>
          <span className="count-bubble">{count}件</span>
        </div>
      </div>
    </Link>
  );
}
