import type { Metadata } from "next";
import { AreaHubPageTemplate } from "@/components/area/AreaHubPageTemplate";
import {
  resolveAreaHubContext,
  resolveAreaHubPageDescription,
  resolveAreaHubPageTitle,
} from "@/lib/area-shop-utils";
import { resolveAreaRankingEntries } from "@/lib/area-shop-ranking";
import { loadPriorityAreaApprovedReviews } from "@/lib/priority-area-hub";
import { shouldLoadLegacyAreaRanking } from "@/lib/priority-area-precision";
import {
  getAreaBySlug,
  getAreaRankingShops,
  getChildAreas,
  getParentArea,
  getSiblingAreas,
} from "@/lib/wp/areas";
import { getAreaShopRankings } from "@/lib/wp/area-shop-rankings";
import { getHomeFeaturedAreas } from "@/lib/wp/home-featured-areas";
import { withWpBuildFallback } from "@/lib/wp/build-resilience";
import { canonicalUrl, pageMetadata } from "@/lib/seo";
import type { AreaView } from "@/lib/wp/types";

export async function renderAreaHubRouteContent(area: AreaView, currentPage: number) {
  const [childAreas, siblingAreas, parentArea, allShops, rankingMap, areaFeatures, areaReviewResult] = await Promise.all([
    withWpBuildFallback(`area hub children ${area.slug}`, () => getChildAreas(area.id), []),
    withWpBuildFallback(`area hub siblings ${area.slug}`, () => getSiblingAreas(area), []),
    withWpBuildFallback(`area hub parent ${area.slug}`, () => getParentArea(area), null),
    withWpBuildFallback(`area hub shops ${area.slug}`, () => getAreaRankingShops(area.id), []),
    shouldLoadLegacyAreaRanking(area)
      ? withWpBuildFallback("area shop rankings", getAreaShopRankings, {})
      : Promise.resolve({}),
    withWpBuildFallback("home featured areas for area hero", getHomeFeaturedAreas, []),
    withWpBuildFallback(
      `priority area approved reviews ${area.slug}`,
      () => loadPriorityAreaApprovedReviews(area),
      null,
    ),
  ]);
  const rankingEntries = resolveAreaRankingEntries(rankingMap, area);

  return (
    <AreaHubPageTemplate
      area={area}
      allShops={allShops}
      legacyPage={currentPage}
      parentArea={parentArea}
      siblingAreas={siblingAreas}
      childAreas={childAreas}
      rankingEntries={rankingEntries}
      areaFeatures={areaFeatures}
      reviewResult={areaReviewResult}
    />
  );
}

export async function generateAreaHubRouteMetadata(slug: string, currentPage: number): Promise<Metadata> {
  const area = await withWpBuildFallback(`area metadata ${slug}`, () => getAreaBySlug(slug), null);
  if (!area) return {};
  const parentArea = await getParentArea(area);
  const hubContext = resolveAreaHubContext(area, parentArea);
  const canonicalPath = `/area/${area.slug}/`;
  const requestPath = currentPage > 1 ? `${canonicalPath}?page=${currentPage}` : canonicalPath;

  return pageMetadata({
    title: resolveAreaHubPageTitle(hubContext, currentPage),
    description: resolveAreaHubPageDescription(hubContext, currentPage),
    path: requestPath,
    canonicalOverride: canonicalUrl(requestPath),
  });
}
