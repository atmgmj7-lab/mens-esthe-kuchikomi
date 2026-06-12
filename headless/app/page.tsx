import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";
import { organizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";
import { getAreas } from "@/lib/wp/areas";
import { getLatestPosts } from "@/lib/wp/posts";
import { getLatestShops, getShopCount } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "Escomi | 関西メンズエステ口コミナビ",
  description:
    "関西メンズエステの口コミ・店舗情報ポータル。エリア、料金、営業時間、出勤状況から店舗を探せます。",
  path: "/"
});

export default async function HomePage() {
  const [shopCount, shops, areas, posts] = await Promise.all([
    getShopCount(),
    getLatestShops(6),
    getAreas(),
    getLatestPosts(6)
  ]);

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
      <HomePageContent shopCount={shopCount} shops={shops} areas={areas} posts={posts} />
    </>
  );
}
