import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getPublicPartnerReviewWidget } from "@/lib/partner/provisioning-service";
import { resolvePublicPartnerWidget } from "@/lib/partner/partner-review-widget";
import { publicReviewAdapter } from "@/lib/reviews/public-adapter";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { getShopById } from "@/lib/wp/shops";

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PartnerReviewWidgetPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  await connection();
  const token = (await params).token;
  const campaign = await getPublicPartnerReviewWidget(token, partnerReviewGrowthRepository);
  if (!campaign) notFound();
  const shop = await getShopById(campaign.shopId);
  if (!shop || shop.publicationStatus !== "publish" || shop.slug !== campaign.shopSlug
    || `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/` !== campaign.canonicalUrl) notFound();
  const reviews = await publicReviewAdapter.getShopReviews(shop, 1, 1);
  if (reviews.status !== "available") notFound();
  const widget = resolvePublicPartnerWidget({
    ...campaign,
    widgetUrl: `https://mens-esthe-kuchikomi.com/partner/widget/${token.toLowerCase()}/`,
    reviewCount: reviews.page.metrics.total.responseCount,
    averageRating: reviews.page.metrics.total.average,
  });
  if (widget.status !== "available") notFound();

  return <main className="hl-partner-widget" aria-label={`${widget.shopName}のEskomi口コミ`}>
    <p className="hl-partner-widget__badge">{widget.badge}</p>
    <p className="hl-partner-widget__shop">{widget.shopName}</p>
    <p>{widget.reviewSummary.kind === "average_and_count"
      ? `評価 ${widget.reviewSummary.average} / 5（${widget.reviewSummary.count}件）`
      : `有効な評価 ${widget.reviewSummary.count}件`}</p>
    <a href={widget.reviewUrl}>Eskomiで口コミを投稿</a>
  </main>;
}
