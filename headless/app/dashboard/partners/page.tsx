import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardPartnerWorkspace } from "@/components/dashboard/DashboardPartnerWorkspace";
import { DashboardReviewModeration } from "@/components/dashboard/DashboardReviewModeration";
import { listPartnerRegistrationReviews } from "@/lib/partner/provisioning-service";
import { pageMetadata } from "@/lib/seo";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { reviewNativeRepository } from "@/lib/supabase/review-native";
import { getAllShopsForListing } from "@/lib/wp/shops";

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
    reviewNativeRepository.listModerationQueue({ limit: 50, offset: 0 }),
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
