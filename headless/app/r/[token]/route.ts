import { NextRequest, NextResponse } from "next/server";

import { openPartnerReviewCampaign } from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const campaign = await openPartnerReviewCampaign(token, partnerReviewGrowthRepository);

  if (!campaign) {
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
  target.searchParams.set("shop", campaign.slug);
  target.searchParams.set("campaign", token);
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
