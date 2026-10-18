import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EskomiCommunityExchange } from "@/components/community/EskomiCommunityExchange";
import { EskomiCorrectionRequest } from "@/components/community/EskomiCorrectionRequest";
import { getShopBySlug } from "@/lib/wp/shops";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;
export default async function ShopCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const shop = await getShopBySlug(slug); if (!shop) notFound();
  return <main id="main_content" className="l-mainContent l-article hl-review-submit-page"><div className="l-mainContent__inner hl-page-inner"><nav aria-label="パンくず"><Link href={`/shops/${shop.slug}/`}>{shop.title}</Link> &gt; 情報交換</nav><EskomiCommunityExchange scope="shop" slug={shop.slug} title={shop.title} /><EskomiCorrectionRequest slug={shop.slug} shopName={shop.title} /></div></main>;
}
