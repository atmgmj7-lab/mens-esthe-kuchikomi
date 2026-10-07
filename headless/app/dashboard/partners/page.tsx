import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardPartnerWorkspace } from "@/components/dashboard/DashboardPartnerWorkspace";
import { DashboardReviewModeration } from "@/components/dashboard/DashboardReviewModeration";
import { listPartnerRegistrationReviews } from "@/lib/partner/provisioning-service";
import { pageMetadata } from "@/lib/seo";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { reviewNativeRepository } from "@/lib/supabase/review-native";
import type { ReviewModerationQueueItem } from "@/lib/reviews/repository";
import { getAllShopsForListing } from "@/lib/wp/shops";

const RANK_UP_WP_SHOP_ID = 768;
const MODERATION_PAGE_SIZE = 100;

/**
 * The existing RPC is global and paginated. Filter server-side only after
 * reading every actionable page so a busy unrelated queue cannot hide Rank UP
 * behind its first 100 records. Only the target shop reaches the client.
 */
async function listRankUpModerationQueue() {
  const reviews: ReviewModerationQueueItem[] = [];
  let offset = 0;
  while (true) {
    const page = await reviewNativeRepository.listModerationQueue({ limit: MODERATION_PAGE_SIZE, offset });
    if (page.status !== "ok") return { status: page.status, data: [] as typeof reviews };
    reviews.push(...page.data.filter((review) => review.shop.wpShopId === RANK_UP_WP_SHOP_ID));
    if (page.data.length < MODERATION_PAGE_SIZE) return { status: "ok" as const, data: reviews };
    offset += MODERATION_PAGE_SIZE;
  }
}

export const metadata: Metadata = pageMetadata({
  title: "Free Official Partner 管理",
  description: "Eskomi運営向けPartner workspace管理",
  path: "/dashboard/partners/",
  robots: { index: false, follow: false },
});

// Private moderation data must never be captured in a prerendered artifact.
export const instant = false;

export default async function DashboardPartnersPage() {
  await connection();

  const [shops, reviews, moderationQueue] = await Promise.all([
    getAllShopsForListing(),
    listPartnerRegistrationReviews(partnerReviewGrowthRepository),
    listRankUpModerationQueue(),
  ]);
  return (
    <>
      <DashboardPartnerWorkspace
        shops={shops.map((shop) => ({ id: shop.id, slug: shop.slug, title: shop.title }))}
        reviews={reviews.map((review) => ({
          submissionId: review.submissionId,
          status: review.status,
          createdAt: review.createdAt,
          workspaceState: review.workspaceState,
          shop: review.shop,
          campaigns: review.campaigns,
        }))}
      />
      <DashboardReviewModeration
        shopName="Mrs.Rank UP"
        wpShopId={RANK_UP_WP_SHOP_ID}
        sourceStatus={moderationQueue.status}
        reviews={moderationQueue.status === "ok" ? moderationQueue.data.map((review) => ({
          reviewId: review.reviewId,
          shop: review.shop,
          body: review.body,
          submittedAt: review.submittedAt,
          rating: review.rating,
          ratingPrice: review.ratingPrice,
          ratingService: review.ratingService,
          ratingCleanliness: review.ratingCleanliness,
          visitPeriod: review.visitPeriod,
          revisitIntent: review.revisitIntent,
          moderationStatus: review.moderationStatus,
          publicationStatus: review.publicationStatus,
          isPublic: review.isPublic,
          nickname: review.nickname,
        })) : []}
      />
    </>
  );
}
