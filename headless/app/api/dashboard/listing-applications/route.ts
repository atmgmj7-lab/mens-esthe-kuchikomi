import { NextRequest, NextResponse } from "next/server";
import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

function failure(status: 401 | 503) {
  return NextResponse.json({ ok: false, message: status === 401 ? "管理画面の認証が必要です。" : "管理画面の設定を確認してください。" }, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Dashboard"' } : {}) } });
}

export async function GET(request: NextRequest) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return failure(authorization.status);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return failure(503);
  const query = new URLSearchParams({ select: "id,kind,existing_wp_shop_id,existing_shop_slug,shop_name,area,website_url,state,revision,contact_name,contact_email,contact_role,edit_preference,banner_asset_id,created_at,updated_at", order: "updated_at.desc", limit: "100" });
  const response = await fetch(`${base}/rest/v1/listing_applications?${query}`, { headers: createSupabaseServerHeaders(secret.value, { "Accept-Profile": "private" }), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ ok: false, message: "申請一覧を取得できませんでした。" }, { status: 503 });
  return NextResponse.json({ ok: true, applications: await response.json() }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
