import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopDetail } from "@/components/ShopDetail";
import { getAreas } from "@/lib/wp/areas";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { resolveShopDetailAreaContext } from "@/lib/shop-detail-area";
import { toShopRouteParam } from "@/lib/shop-route-param";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { getApprovedShopReviews } from "@/lib/wp/reviews";
import { getShopBySlug, getShopsForSitemap } from "@/lib/wp/shops";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getStaticParamsOrFallback(
    "shop static params",
    getShopsForSitemap,
    (shop) => ({
      slug: toShopRouteParam(shop.slug)
    }),
    [{ slug: "__wp-build-fallback__" }]
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await withWpBuildFallback(`shop metadata ${slug}`, () => getShopBySlug(slug), null);
  if (!shop) return {};

  const primaryAreaName = shop.primaryArea?.name ?? "";
  const title = primaryAreaName
    ? `${shop.title}の口コミ・店舗情報｜${primaryAreaName}メンズエステ`
    : `${shop.title}の口コミ・店舗情報`;

  return pageMetadata({
    title,
    description: makeDescription(
      shop.acf.shop_catch || shop.excerpt,
      `${shop.title}の承認済み口コミと公開店舗情報を掲載しています。料金・営業時間・予約先・アクセスは確認できる項目だけ表示します。`
    ),
    path: `/shops/${shop.slug}/`
  });
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await withWpBuildFallback(`shop page ${slug}`, () => getShopBySlug(slug), null);
  if (!shop) notFound();

  const [allAreas, reviewResult] = await Promise.all([
    withWpBuildFallback(`shop area list ${shop.slug}`, getAreas, []),
    getApprovedShopReviews(shop.id, 1, 3)
  ]);
  const { parent: parentArea } = resolveShopDetailAreaContext(shop, allAreas);

  return (
    <ShopDetail
      shop={shop}
      parentArea={parentArea}
      reviewResult={reviewResult}
    />
  );
}
