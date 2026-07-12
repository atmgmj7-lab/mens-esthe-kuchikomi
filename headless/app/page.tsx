import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";
import { organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";
import { getAreas } from "@/lib/wp/areas";
import { getLatestPosts } from "@/lib/wp/posts";
import { getLatestShops, getShopCount } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "Escomi | 関西メンズエステ口コミナビ",
  description:
    "関西メンズエステの店舗情報・口コミ投稿ポータル。エリア、料金、営業時間、出勤状況から店舗を探せます。",
  path: "/"
});

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function HomePage() {
  const [shopCountResult, shopsResult, areasResult, postsResult] = await Promise.allSettled([
    getShopCount(),
    getLatestShops(6),
    getAreas(),
    getLatestPosts(6)
  ]);
  const shopCount = settledValue(shopCountResult, 0);
  const shops = settledValue(shopsResult, []);
  const areas = settledValue(areasResult, []);
  const posts = settledValue(postsResult, []);
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
      <HomePageContent shopCount={shopCount} shops={shops} areas={areas} posts={posts} dataState={dataState} />
    </>
  );
}
