import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EskomiCommunityExchange } from "@/components/community/EskomiCommunityExchange";
import { getAreaBySlug } from "@/lib/wp/areas";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;
export default async function AreaCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const area = await getAreaBySlug(slug); if (!area) notFound();
  return <main id="main_content" className="l-mainContent l-article hl-review-submit-page"><div className="l-mainContent__inner hl-page-inner"><nav aria-label="パンくず"><Link href={`/area/${area.slug}/`}>{area.name}</Link> &gt; 情報交換</nav><EskomiCommunityExchange scope="area" slug={area.slug} title={area.name} /></div></main>;
}
