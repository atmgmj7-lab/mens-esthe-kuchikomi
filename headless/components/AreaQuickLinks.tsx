import Link from "next/link";
import { KANSAI_AREAS } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";

type AreaQuickLinksProps = {
  areas: AreaView[];
  current?: string;
  title?: string;
  className?: string;
};

export function AreaQuickLinks({
  areas,
  current,
  title = "エリアから探す",
  className = ""
}: AreaQuickLinksProps) {
  const parentSlugs = new Set<string>(KANSAI_AREAS.map((item) => item.slug));
  const countBySlug = Object.fromEntries(areas.map((area) => [area.slug, area.count]));

  const parentLinks = KANSAI_AREAS.map((item) => ({
    slug: item.slug,
    name: item.name,
    count: countBySlug[item.slug] ?? 0
  }));

  const childLinks = areas
    .filter((area) => area.parent !== 0 && !parentSlugs.has(area.slug))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));

  const links = [...parentLinks, ...childLinks.map((area) => ({
    slug: area.slug,
    name: area.name,
    count: area.count
  }))];

  if (links.length === 0) return null;

  return (
    <section className={`hl-area-quick-links es-area-link-section ${className}`.trim()}>
      <h2 className="hl-area-quick-links__title">{title}</h2>
      <div className="es-area-grid hl-area-quick-links__grid">
        {links.map((area) => (
          <Link
            key={area.slug}
            href={`/area/${area.slug}/`}
            className={`es-area-link-item ${current === area.slug ? "is-current" : ""}`}
          >
            <span className="es-area-name">{area.name}</span>
            {area.count > 0 ? <span className="es-area-count">({area.count}件)</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
