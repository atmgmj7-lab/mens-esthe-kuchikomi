import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";
import { organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import { getAreas } from "@/lib/wp/areas";
import { getHomeFeaturedAreas } from "@/lib/wp/home-featured-areas";
import { getLatestPosts } from "@/lib/wp/posts";
import { getApprovedReviewsPage } from "@/lib/wp/reviews";
import { getLatestShops, getShopCount } from "@/lib/wp/shops";
import type { ApprovedGlobalReviewResult } from "@/lib/wp/types";

export const metadata: Metadata = pageMetadata({
  title: "Eskomi | 関西メンズエステ口コミナビ",
  description:
    "関西メンズエステの店舗情報・口コミ投稿ポータル。エリア、料金、営業時間、出勤状況から店舗を探せます。",
  path: "/"
});

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function HomePage() {
  const [shopCountResult, shopsResult, areasResult, postsResult, areaFeaturesResult, reviewsResult] = await Promise.allSettled([
    getShopCount(),
    getLatestShops(6),
    getAreas(),
    getLatestPosts(6),
    getHomeFeaturedAreas(),
    getApprovedReviewsPage(1, 12),
  ]);
  const shopCount = settledValue(shopCountResult, 0);
  const shops = settledValue(shopsResult, []);
  const areas = settledValue(areasResult, []);
  const posts = settledValue(postsResult, []);
  const areaFeatures = settledValue(areaFeaturesResult, []);
  const reviews = settledValue<ApprovedGlobalReviewResult>(reviewsResult, {
    status: "unavailable",
    reason: "request-failed",
  });
  const dataState = {
    shopCountFailed: shopCountResult.status === "rejected",
    shopsFailed: shopsResult.status === "rejected",
    areasFailed: areasResult.status === "rejected",
    postsFailed: postsResult.status === "rejected"
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <HomePageContent
        shopCount={shopCount}
        shops={shops}
        areas={areas}
        areaFeatures={areaFeatures}
        posts={posts}
        reviewResult={reviews}
        strictRanking={unavailableStrictRanking("overall")}
        dataState={dataState}
      />
    </>
  );
}
