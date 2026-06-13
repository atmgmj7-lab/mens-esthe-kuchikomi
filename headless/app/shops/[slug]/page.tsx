import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopDetail } from "@/components/ShopDetail";
import { getAreaById, getAreas } from "@/lib/wp/areas";
import { isNihonbashiShop } from "@/lib/nihonbashi-shop-utils";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { getShopBySlug, getShopsForSitemap } from "@/lib/wp/shops";
import type { ShopView } from "@/lib/wp/types";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const shops = await getShopsForSitemap();
  return shops.map((shop) => ({ slug: shop.slug }));
}

async function resolveShopParentArea(shop: ShopView) {
  const allAreas = await getAreas();

  if (shop.areaSlug) {
    const matched = allAreas.find((a) => a.slug === shop.areaSlug);
    if (matched) {
      if (matched.parent) {
        return getAreaById(matched.parent);
      }
      return matched;
    }
  }

  const childArea = shop.terms.find((t) => t.parent !== 0);
  if (childArea?.parent) {
    return getAreaById(childArea.parent);
  }
  const parentArea = shop.terms.find((t) => t.parent === 0);
  return parentArea ? getAreaById(parentArea.id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) return {};

  const title = isNihonbashiShop(shop)
    ? `${shop.title}｜日本橋メンズエステの口コミ・料金・営業時間`
    : shop.title;

  return pageMetadata({
    title,
    description: makeDescription(
      shop.acf.shop_catch || shop.excerpt,
      `${shop.title}の店舗情報、料金、営業時間、口コミ情報。`
    ),
    path: `/shops/${shop.slug}/`
  });
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const parentArea = await resolveShopParentArea(shop);
  const allAreas = await getAreas();

  return <ShopDetail shop={shop} parentArea={parentArea} allAreas={allAreas} />;
}
