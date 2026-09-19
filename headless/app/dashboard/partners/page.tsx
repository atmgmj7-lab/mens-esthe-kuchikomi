import type { Metadata } from "next";
import { DashboardPartnerWorkspace } from "@/components/dashboard/DashboardPartnerWorkspace";
import { listPartnerRegistrationReviews } from "@/lib/partner/provisioning-service";
import { pageMetadata } from "@/lib/seo";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { getAllShopsForListing } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "Free Official Partner 管理",
  description: "Eskomi運営向けPartner workspace管理",
  path: "/dashboard/partners/",
  robots: { index: false, follow: false },
});

export default async function DashboardPartnersPage() {
  const [shops, reviews] = await Promise.all([
    getAllShopsForListing(),
    listPartnerRegistrationReviews(partnerReviewGrowthRepository),
  ]);
  return (
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
  );
}
