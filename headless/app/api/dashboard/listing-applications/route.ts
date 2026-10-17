import { NextRequest, NextResponse } from "next/server";
import { authorizeListingDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret, supabaseRpcUrl } from "@/lib/supabase/server-secret";

function failure(status: 401 | 503) {
  return NextResponse.json({ ok: false, message: status === 401 ? "管理画面の認証が必要です。" : "管理画面の設定を確認してください。" }, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Dashboard"' } : {}) } });
}

export async function GET(request: NextRequest) {
  const authorization = authorizeListingDashboardRequest(request.headers.get("authorization"), request.cookies.get("eskomi_dashboard_session")?.value, process.env);
  if (!authorization.ok) return failure(authorization.status);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return failure(503);
  const response = await fetch(supabaseRpcUrl(base, "get_listing_application_operator_list"), { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }), body: "{}", cache: "no-store" });
  if (!response.ok) return NextResponse.json({ ok: false, message: "申請一覧を取得できませんでした。" }, { status: 503 });
  const applications = await response.json();
  return NextResponse.json({ ok: true, applications: Array.isArray(applications) ? applications : [] }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
