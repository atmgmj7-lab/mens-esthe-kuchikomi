import Link from "next/link";
import { resolveAreaHeroImage, type AreaFeatureItem } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";

export function AreaHero({
  area,
  parent,
  areaFeatures = []
}: {
  area: AreaView;
  parent?: AreaView | null;
  areaFeatures?: readonly AreaFeatureItem[];
}) {
  const bgUrl = resolveAreaHeroImage(area, parent, areaFeatures);

  return (
    <header
      className="area-archive-header hl-fade-in"
      style={{ backgroundImage: `url(${bgUrl})` }}
    >
      <div className="area-header-overlay">
        <h1 className="archive-title">{area.name}のメンズエステ</h1>
      </div>
    </header>
  );
}

export function AreaBreadcrumb({
  area,
  parent
}: {
  area: AreaView;
  parent?: AreaView | null;
}) {
  return (
    <div className="area-breadcrumb u-mb-40">
      <Link href="/">TOP</Link> &gt;{" "}
      <Link href="/shops/">エリア一覧</Link> &gt;{" "}
      {parent ? (
        <>
          <Link href={`/area/${parent.slug}/`}>{parent.name}</Link> &gt;{" "}
        </>
      ) : null}
      <span className="current-area">{area.name}</span>
    </div>
  );
}
