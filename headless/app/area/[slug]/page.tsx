import type { Metadata } from "next";
import { sanitizeAreaText } from "@/lib/area-content-integrity";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AreaHubPageTemplate } from "@/components/area/AreaHubPageTemplate";
import { AreaPageView } from "@/components/AreaPageView";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import { isHubTemplateArea } from "@/lib/area-hub-config";
import {
  resolveAreaHubContext,
  resolveAreaHubPageDescription,
  resolveAreaHubPageTitle
} from "@/lib/area-shop-utils";
import {
  getAreaBySlug,
  getAreaRankingShops,
  getAreaShops,
  getAreas,
  getChildAreas,
  getParentArea,
  getSiblingAreas
} from "@/lib/wp/areas";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { canonicalUrl, makeDescription, pageMetadata } from "@/lib/seo";

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
  return getStaticParamsOrFallback(
    "area static params",
    getAreas,
    (area) => ({ slug: area.slug }),
    [{ slug: "osaka" }]
  );
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = parsePage(pageParam);
  const area = await withWpBuildFallback(`area metadata ${slug}`, () => getAreaBySlug(slug), null);
  if (!area) return {};

  if (isHubTemplateArea(slug)) {
    const parentArea = await getParentArea(area);
    const hubContext = resolveAreaHubContext(area, parentArea);
    const canonicalPath = `/area/${area.slug}/`;
    const requestPath =
      currentPage > 1 ? `/area/${area.slug}/?page=${currentPage}` : canonicalPath;

    return pageMetadata({
      title: resolveAreaHubPageTitle(hubContext, currentPage),
      description: resolveAreaHubPageDescription(hubContext, currentPage),
      path: requestPath,
      canonicalOverride: canonicalUrl(requestPath)
    });
  }

  return pageMetadata({
    title: `${area.name}のメンズエステ`,
    description: makeDescription(
    sanitizeAreaText(area.slug, area.acf.area_characteristics || area.description),
    `${area.name}のメンズエステ店舗一覧。駅近、営業時間、料金、掲載情報、予約導線を比較しながら探せます。`
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
  const area = await withWpBuildFallback(`area page ${slug}`, () => getAreaBySlug(slug), null);
  if (!area) notFound();

  const isHub = isHubTemplateArea(slug);

  if (isHub) {
    const [childAreas, siblingAreas, parentArea, allShops] = await Promise.all([
      withWpBuildFallback(`area hub children ${area.slug}`, () => getChildAreas(area.id), []),
      withWpBuildFallback(`area hub siblings ${area.slug}`, () => getSiblingAreas(area), []),
      withWpBuildFallback(`area hub parent ${area.slug}`, () => getParentArea(area), null),
      withWpBuildFallback(`area hub shops ${area.slug}`, () => getAreaRankingShops(area.id), [])
    ]);

    return (
      <AreaHubPageTemplate
        area={area}
        allShops={allShops}
        legacyPage={currentPage}
        parentArea={parentArea}
        siblingAreas={siblingAreas}
        childAreas={childAreas}
      />
    );
  }

  const emptyShopsResult = { shops: [], totalPages: 1 };
  const [shopsResult, childAreas, siblingAreas, parentArea, seoShopsResult] = await Promise.all([
    withWpBuildFallback(`area shops ${area.slug}`, () => getAreaShops(area.id, currentPage), emptyShopsResult),
    withWpBuildFallback(`area children ${area.slug}`, () => getChildAreas(area.id), []),
    withWpBuildFallback(`area siblings ${area.slug}`, () => getSiblingAreas(area), []),
    withWpBuildFallback(`area parent ${area.slug}`, () => getParentArea(area), null),
    currentPage > 1
      ? withWpBuildFallback(`area seo shops ${area.slug}`, () => getAreaShops(area.id, 1), null)
      : Promise.resolve(null)
  ]);

  if (currentPage > shopsResult.totalPages) {
    notFound();
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
