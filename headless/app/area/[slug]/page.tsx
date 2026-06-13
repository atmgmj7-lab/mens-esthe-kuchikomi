import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AreaPageView } from "@/components/AreaPageView";
import { NihonbashiAreaHubPage } from "@/components/NihonbashiAreaHubPage";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import {
  NIHONBASHI_HUB_DESCRIPTION,
  NIHONBASHI_HUB_TITLE
} from "@/lib/nihonbashi-shop-utils";
import { getAreaBySlug, getAreaShops, getAreas, getChildAreas, getParentArea, getSiblingAreas } from "@/lib/wp/areas";
import { makeDescription, pageMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export async function generateStaticParams() {
  const areas = await getAreas();
  return areas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) return {};

  if (slug === "nihonbashi") {
    return pageMetadata({
      title: NIHONBASHI_HUB_TITLE,
      description: NIHONBASHI_HUB_DESCRIPTION,
      path: "/area/nihonbashi/"
    });
  }

  return pageMetadata({
    title: `${area.name}のメンズエステ`,
    description: makeDescription(
      area.acf.area_characteristics || area.description,
      `${area.name}のメンズエステ店舗一覧。駅近、営業時間、料金、口コミ、予約導線を比較しながら探せます。`
    ),
    path: `/area/${area.slug}/`
  });
}

export default function AreaPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<RoutePageFallback variant="area" />}>
      <AreaPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AreaPageContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = parsePage(pageParam);
  const area = await getAreaBySlug(slug);
  if (!area) notFound();

  const [shopsResult, childAreas, siblingAreas, parentArea, seoShopsResult] = await Promise.all([
    getAreaShops(area.id, currentPage),
    getChildAreas(area.id),
    getSiblingAreas(area),
    getParentArea(area),
    currentPage > 1 ? getAreaShops(area.id, 1) : Promise.resolve(null)
  ]);

  if (currentPage > shopsResult.totalPages) {
    notFound();
  }

  if (slug === "nihonbashi" && currentPage === 1) {
    const rankingShops = shopsResult.shops;
    return (
      <NihonbashiAreaHubPage
        area={area}
        shops={shopsResult.shops}
        rankingShops={rankingShops}
        currentPage={currentPage}
        totalPages={shopsResult.totalPages}
      />
    );
  }

  return (
    <AreaPageView
      area={area}
      shops={shopsResult.shops}
      currentPage={currentPage}
      totalPages={shopsResult.totalPages}
      seoShops={seoShopsResult?.shops}
      childAreas={childAreas}
      siblingAreas={siblingAreas}
      parentArea={parentArea}
    />
  );
}
