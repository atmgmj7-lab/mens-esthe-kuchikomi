import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaPageView } from "@/components/AreaPageView";
import { getAreaBySlug, getAreaShops, getAreas, getChildAreas, getParentArea, getSiblingAreas } from "@/lib/wp/areas";
import { makeDescription, pageMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const areas = await getAreas();
  return areas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) return {};
  return pageMetadata({
    title: `${area.name}のメンズエステ`,
    description: makeDescription(
      area.acf.area_characteristics || area.description,
      `${area.name}エリアのメンズエステ店舗一覧、料金、営業時間、口コミ情報。`
    ),
    path: `/area/${area.slug}/`
  });
}

export default async function AreaPage({ params }: Props) {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) notFound();

  const [shops, childAreas, siblingAreas, parentArea] = await Promise.all([
    getAreaShops(area.id),
    getChildAreas(area.id),
    getSiblingAreas(area),
    getParentArea(area)
  ]);

  return (
    <AreaPageView
      area={area}
      shops={shops}
      childAreas={childAreas}
      siblingAreas={siblingAreas}
      parentArea={parentArea}
    />
  );
}
