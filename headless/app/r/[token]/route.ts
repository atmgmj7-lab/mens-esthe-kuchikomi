import { NextRequest, NextResponse } from "next/server";

import {
  openPartnerReviewCampaign,
  recordPartnerReviewCampaignVisit,
} from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { getShopById } from "@/lib/wp/shops";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const campaign = await openPartnerReviewCampaign(token, partnerReviewGrowthRepository);
  const shop = campaign ? await getShopById(campaign.id) : null;
  const recorded = shop?.publicationStatus === "publish"
    ? await recordPartnerReviewCampaignVisit(
    { token, event: "open" },
    partnerReviewGrowthRepository,
    )
    : null;

  if (!campaign || !shop || shop.publicationStatus !== "publish" || recorded?.id !== shop.id) {
    return new NextResponse("対象を確認できません。", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const target = new URL("/reviews/submit/", request.nextUrl.origin);
  target.searchParams.set("shop", shop.slug);
  target.searchParams.set("campaign", token);
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
