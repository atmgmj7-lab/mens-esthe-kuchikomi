import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ShopDetail } from "@/components/ShopDetail";
import { getAreas } from "@/lib/wp/areas";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { resolveShopDetailAreaContext } from "@/lib/shop-detail-area";
import { publicReviewAdapter } from "@/lib/reviews/public-adapter";
import { toShopRouteParam } from "@/lib/shop-route-param";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { getShopBySlug, getShopsForSitemap } from "@/lib/wp/shops";
import { getPublicPartnerListing } from "@/lib/partner/public-listing";
import { PublicPartnerListing } from "@/components/partner/PublicPartnerListing";

type Props = {
  params: Promise<{ slug: string }>;
};
export const instant = false;

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
  const [shop, partner] = await Promise.all([withWpBuildFallback(`shop metadata ${slug}`, () => getShopBySlug(slug), null), getPublicPartnerListing(slug)]);
  if (!shop) {
    if (partner) return pageMetadata({ title: `${partner.shop_name}の店舗情報`, description: partner.introduction || `${partner.shop_name}の承認済み店舗情報`, path: `/shops/${partner.shop_slug}/` });
    // Metadata resolves before the PPR shell. This preserves an HTTP 404 for
    // unpublished managed shops instead of only showing the not-found UI.
    notFound();
  }

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
  await connection();
  const { slug } = await params;
  const [shop, partner] = await Promise.all([withWpBuildFallback(`shop page ${slug}`, () => getShopBySlug(slug), null), getPublicPartnerListing(slug)]);
  if (!shop && !partner) notFound();
  if (!shop && partner) return <PublicPartnerListing listing={partner} />;
  if (!shop) notFound();
  const approvedShop = partner ? { ...shop, contentHtml: partner.introduction ?? shop.contentHtml, imageUrl: partner.banner_asset_id ? `/api/partner/listing/banner/${partner.banner_asset_id}/` : shop.imageUrl, media: partner.banner_asset_id ? { ...shop.media, cardSquare: { ...shop.media.cardSquare, url: `/api/partner/listing/banner/${partner.banner_asset_id}/`, source: "legacy-acf" as const, alt: `${shop.title} の掲載画像` } } : shop.media, officialUrl: partner.website_url || shop.officialUrl } : shop;

  const [allAreas, reviewResult] = await Promise.all([
    withWpBuildFallback(`shop area list ${approvedShop.slug}`, getAreas, []),
    publicReviewAdapter.getShopReviews(approvedShop, 1, 3)
  ]);
  const { parent: parentArea } = resolveShopDetailAreaContext(approvedShop, allAreas);

  return (
    <ShopDetail
      shop={approvedShop}
      parentArea={parentArea}
      reviewResult={reviewResult}
    />
  );
}
