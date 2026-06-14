import Link from "next/link";
import { EsSectionTitle } from "@/components/SectionTitle";
import type { AreaView } from "@/lib/wp/types";

export function AreaHubRelatedAreas({
  area,
  parentArea,
  siblingAreas,
  childAreas
}: {
  area: AreaView;
  parentArea?: AreaView | null;
  siblingAreas: AreaView[];
  childAreas: AreaView[];
}) {
  const hasSiblings = Boolean(parentArea && siblingAreas.length > 0);
  const hasChildren = childAreas.length > 0;

  if (!hasSiblings && !hasChildren) return null;

  return (
    <section className="area-hub-section area-hub-section--related" id="related-areas">
      <EsSectionTitle en="AREAS" ja="関連エリア" large />

      {hasChildren ? (
        <div className="area-hub-related-group">
          <h3 className="area-hub-related-group__title">{area.name}の詳細エリア</h3>
          <ul className="area-hub-related-grid">
            {childAreas.map((child) => (
              <li key={child.id}>
                <Link href={`/area/${child.slug}/`} className="area-hub-related-card">
                  <span className="area-hub-related-card__name">{child.name}</span>
                  <span className="area-hub-related-card__count">{child.count}件</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasSiblings && parentArea ? (
        <div className="area-hub-related-group">
          <h3 className="area-hub-related-group__title">{parentArea.name}の他のエリア</h3>
          <ul className="area-hub-related-grid">
            <li>
              <Link href={`/area/${parentArea.slug}/`} className="area-hub-related-card area-hub-related-card--all">
                <span className="area-hub-related-card__name">{parentArea.name}すべて</span>
                <span className="area-hub-related-card__count">{parentArea.count}件</span>
              </Link>
            </li>
            {siblingAreas.map((sibling) => (
              <li key={sibling.id}>
                <Link
                  href={`/area/${sibling.slug}/`}
                  className={`area-hub-related-card${sibling.slug === area.slug ? " is-current" : ""}`}
                >
                  <span className="area-hub-related-card__name">{sibling.name}</span>
                  <span className="area-hub-related-card__count">{sibling.count}件</span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/area/${area.slug}/`}
                className="area-hub-related-card is-current"
                aria-current="page"
              >
                <span className="area-hub-related-card__name">{area.name}</span>
                <span className="area-hub-related-card__count">{area.count}件</span>
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
