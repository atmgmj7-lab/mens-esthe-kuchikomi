import type { Metadata } from "next";
import { sanitizeAreaText } from "@/lib/area-content-integrity";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { renderAreaHubRouteContent } from "@/components/area/AreaHubRouteContent";
import { AreaPageView } from "@/components/AreaPageView";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import { isHubTemplateArea } from "@/lib/area-hub-config";
import {
  resolveAreaHubContext,
  resolveAreaHubPageDescription,
  resolveAreaHubPageTitle
} from "@/lib/area-shop-utils";
import { resolveAreaRankingEntries } from "@/lib/area-shop-ranking";
import { shouldLoadLegacyAreaRanking } from "@/lib/priority-area-precision";
import {
  getAreaBySlug,
  getAreaShops,
  getAreas,
  getChildAreas,
  getParentArea,
  getSiblingAreas
} from "@/lib/wp/areas";
import { getAreaShopRankings } from "@/lib/wp/area-shop-rankings";
import { getHomeFeaturedAreas } from "@/lib/wp/home-featured-areas";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { canonicalUrl, makeDescription, pageMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const AREA_SLUG_ALIASES: Record<string, string> = {
  "sakaisuji-hommachi": "sakaisujihonmachi"
};

const STATIC_AREA_ROUTES = new Set(["shinosaka", "sakai"]);

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export async function generateStaticParams() {
  return getStaticParamsOrFallback(
    "area static params",
    async () => (await getAreas()).filter((area) => !STATIC_AREA_ROUTES.has(area.slug)),
    (area) => ({ slug: area.slug }),
    [{ slug: "osaka" }]
  );
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const { page: pageParam } = await searchParams;
  const slug = AREA_SLUG_ALIASES[rawSlug] ?? rawSlug;
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
  const { slug: rawSlug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = parsePage(pageParam);
  const slug = AREA_SLUG_ALIASES[rawSlug] ?? rawSlug;

  if (slug !== rawSlug) {
    const pageSuffix = currentPage > 1 ? `?page=${currentPage}` : "";
    redirect(`/area/${slug}/${pageSuffix}`);
  }

  const area = await withWpBuildFallback(`area page ${slug}`, () => getAreaBySlug(slug), null);
  if (!area) notFound();

  const isHub = isHubTemplateArea(slug);

  if (isHub) {
    return renderAreaHubRouteContent(area, currentPage);
  }

  const emptyShopsResult = { shops: [], totalPages: 1 };
  const [shopsResult, childAreas, siblingAreas, parentArea, seoShopsResult, rankingMap, areaFeatures] = await Promise.all([
    withWpBuildFallback(`area shops ${area.slug}`, () => getAreaShops(area.id, currentPage), emptyShopsResult),
    withWpBuildFallback(`area children ${area.slug}`, () => getChildAreas(area.id), []),
    withWpBuildFallback(`area siblings ${area.slug}`, () => getSiblingAreas(area), []),
    withWpBuildFallback(`area parent ${area.slug}`, () => getParentArea(area), null),
    currentPage > 1
      ? withWpBuildFallback(`area seo shops ${area.slug}`, () => getAreaShops(area.id, 1), null)
      : Promise.resolve(null),
    shouldLoadLegacyAreaRanking(area)
      ? withWpBuildFallback("area shop rankings", getAreaShopRankings, {})
      : Promise.resolve({}),
    withWpBuildFallback("home featured areas for area archive hero", getHomeFeaturedAreas, [])
  ]);
  const rankingEntries = resolveAreaRankingEntries(rankingMap, area);

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
      rankingEntries={rankingEntries}
      areaFeatures={areaFeatures}
    />
  );
}
