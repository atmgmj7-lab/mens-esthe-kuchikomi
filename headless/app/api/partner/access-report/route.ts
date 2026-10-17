import { NextRequest, NextResponse } from "next/server";

import { partnerTherapistNoStore, partnerTherapistRequestContext } from "@/lib/partner/therapist-tools-server";
import { buildPartnerAccessReportPeriod, isPartnerAccessReportDays } from "@/lib/partner/access-report-period";

const fail = (message: string, status: 401 | 403 | 503) => NextResponse.json({ ok: false, message }, { status, headers: partnerTherapistNoStore });

export async function GET(request: NextRequest) {
  const context = await partnerTherapistRequestContext(request);
  if (context.status !== "allowed") return fail("この店舗のアクセス報告を確認できません。", context.status === "unavailable" ? 503 : context.status === "unauthenticated" ? 401 : 403);
  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  if (!Number.isSafeInteger(days) || !isPartnerAccessReportDays(days)) return NextResponse.json({ ok: false, message: "期間を確認してください。" }, { status: 400, headers: partnerTherapistNoStore });
  const period = buildPartnerAccessReportPeriod(days);
  const result = await fetch(`${context.base}/rest/v1/rpc/get_partner_shop_access_report_v11`, {
    method: "POST", headers: context.headers,
    body: JSON.stringify({ p_workspace_id: context.workspaceId, p_auth_user_id: context.authUserId, p_from: period.previousFrom, p_to: period.to }), cache: "no-store",
  }).catch(() => null);
  const rows = result?.ok ? await result.json() as unknown : null;
  if (!Array.isArray(rows)) return fail("アクセス報告を取得できませんでした。", 503);
  return NextResponse.json({ ok: true, ...period, rows }, { headers: partnerTherapistNoStore });
}
