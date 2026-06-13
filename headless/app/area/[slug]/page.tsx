import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AreaHubPageTemplate } from "@/components/area/AreaHubPageTemplate";
import { AreaPageView } from "@/components/AreaPageView";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import {
  resolveAreaHubCanonicalPath,
  resolveAreaHubContext,
  resolveAreaHubPageDescription,
  resolveAreaHubPageTitle
} from "@/lib/area-shop-utils";
import { getAreaBySlug, getAreaShops, getAreas, getChildAreas, getParentArea, getSiblingAreas } from "@/lib/wp/areas";
import { makeDescription, pageMetadata } from "@/lib/seo";

/** 共通ハブテンプレートを適用するエリア（段階的展開） */
const HUB_TEMPLATE_AREAS = new Set(["nihonbashi"]);

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

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = parsePage(pageParam);
  const area = await getAreaBySlug(slug);
  if (!area) return {};

  if (HUB_TEMPLATE_AREAS.has(slug)) {
    const parentArea = await getParentArea(area);
    const hubContext = resolveAreaHubContext(area, parentArea);
    const path = resolveAreaHubCanonicalPath(area.slug, currentPage);
    return pageMetadata({
      title: resolveAreaHubPageTitle(hubContext, currentPage),
      description: resolveAreaHubPageDescription(hubContext, currentPage),
      path
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

  const [shopsResult, childAreas, siblingAreas, parentArea, seoShopsResult, page1ShopsResult] =
    await Promise.all([
      getAreaShops(area.id, currentPage),
      getChildAreas(area.id),
      getSiblingAreas(area),
      getParentArea(area),
      currentPage > 1 ? getAreaShops(area.id, 1) : Promise.resolve(null),
      HUB_TEMPLATE_AREAS.has(slug) && currentPage > 1
        ? getAreaShops(area.id, 1)
        : Promise.resolve(null)
    ]);

  if (currentPage > shopsResult.totalPages) {
    notFound();
  }

  if (HUB_TEMPLATE_AREAS.has(slug)) {
    const rankingShops =
      currentPage === 1 ? shopsResult.shops : page1ShopsResult?.shops ?? shopsResult.shops;

    return (
      <AreaHubPageTemplate
        area={area}
        shops={shopsResult.shops}
        rankingShops={rankingShops}
        currentPage={currentPage}
        totalPages={shopsResult.totalPages}
        parentArea={parentArea}
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
