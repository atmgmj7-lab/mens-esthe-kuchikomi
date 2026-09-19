import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { openPartnerReviewCampaign } from "@/lib/partner/provisioning-service";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";

const TOKEN_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function authorizationFailure(status: 401 | 503): NextResponse {
  return new NextResponse(status === 503 ? "管理画面の認証設定を確認してください" : "認証が必要です", {
    status,
    headers: {
      ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Dashboard"' } : {}),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function unavailable(status: 400 | 404): NextResponse {
  return new NextResponse("対象を確認できません。", {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(request: NextRequest) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return authorizationFailure(authorization.status);

  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return unavailable(400);
  const campaign = await openPartnerReviewCampaign(token, partnerReviewGrowthRepository);
  if (!campaign) return unavailable(404);

  const target = new URL(`/r/${token}/`, request.nextUrl.origin).toString();
  const svg = await QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 512 });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": "inline; filename=partner-review-qr.svg",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
