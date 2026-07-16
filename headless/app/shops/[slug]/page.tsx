import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopDetail } from "@/components/ShopDetail";
import { getAreaById, getAreas } from "@/lib/wp/areas";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { toShopRouteParam } from "@/lib/shop-route-param";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { getShopBySlug, getShopsForSitemap } from "@/lib/wp/shops";
import type { ShopView } from "@/lib/wp/types";

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

async function resolveShopParentArea(shop: ShopView) {
  const allAreas = await withWpBuildFallback(`shop parent area list ${shop.slug}`, getAreas, []);

  if (shop.areaSlug) {
    const matched = allAreas.find((a) => a.slug === shop.areaSlug);
    if (matched) {
      if (matched.parent) {
        return withWpBuildFallback(`shop parent area ${shop.slug}`, () => getAreaById(matched.parent), null);
      }
      return matched;
    }
  }

  const childArea = shop.terms.find((t) => t.parent !== 0);
  if (childArea?.parent) {
    return withWpBuildFallback(`shop child parent area ${shop.slug}`, () => getAreaById(childArea.parent), null);
  }
  const parentArea = shop.terms.find((t) => t.parent === 0);
  return parentArea
    ? withWpBuildFallback(`shop fallback parent area ${shop.slug}`, () => getAreaById(parentArea.id), null)
    : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await withWpBuildFallback(`shop metadata ${slug}`, () => getShopBySlug(slug), null);
  if (!shop) return {};

  const primaryAreaName =
    shop.terms?.find((term) => term.parent !== 0)?.name || shop.terms?.[0]?.name || "";
  const title = primaryAreaName
    ? `${shop.title}｜${primaryAreaName}メンズエステの店舗情報・料金・営業時間`
    : shop.title;

  return pageMetadata({
    title,
    description: makeDescription(
      shop.acf.shop_catch || shop.excerpt,
      `${shop.title}の店舗情報、料金、営業時間、掲載情報コメント。`
    ),
    path: `/shops/${shop.slug}/`
  });
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await withWpBuildFallback(`shop page ${slug}`, () => getShopBySlug(slug), null);
  if (!shop) notFound();

  const parentArea = await resolveShopParentArea(shop);
  const allAreas = await withWpBuildFallback(`shop area list ${shop.slug}`, getAreas, []);

  return <ShopDetail shop={shop} parentArea={parentArea} allAreas={allAreas} />;
}
