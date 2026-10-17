import { NextRequest, NextResponse } from "next/server";

import { authorizePartnerTherapistSession, PARTNER_SESSION_COOKIE } from "@/lib/partner/partner-session";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function failure(message: string, status: 400 | 401 | 403 | 409 | 503) {
  return NextResponse.json({ ok: false, message }, { status, headers: noStore });
}

async function context(request: NextRequest) {
  const session = await authorizePartnerTherapistSession({ accessToken: request.cookies.get(PARTNER_SESSION_COOKIE)?.value ?? null });
  if (session.status !== "allowed") return { error: failure("この店舗の編集権限を確認できません。", session.status === "unavailable" ? 503 : 401) } as const;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return { error: failure("編集機能の設定を確認してください。", 503) } as const;
  return {
    base,
    workspaceId: session.access.workspaceId,
    authUserId: session.access.authUserId,
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }),
  } as const;
}

function payload(body: Record<string, unknown>) {
  const shopName = typeof body.shopName === "string" ? body.shopName.trim() : "";
  const area = typeof body.area === "string" ? body.area.trim() : "";
  const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const introduction = typeof body.introduction === "string" ? body.introduction.trim() : "";
  if (!shopName || shopName.length > 120 || !area || area.length > 120 || introduction.length > 5000) return null;
  try {
    const url = new URL(websiteUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const bannerAssetId = typeof body.bannerAssetId === "string" && /^[0-9a-f-]{36}$/i.test(body.bannerAssetId) ? body.bannerAssetId : null;
    return { shop_name: shopName, area, website_url: url.toString(), introduction: introduction || null, banner_asset_id: bannerAssetId };
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const c = await context(request); if ("error" in c) return c.error;
  const response = await fetch(`${c.base}/rest/v1/rpc/get_partner_canonical_listing_editor`, { method: "POST", headers: c.headers, body: JSON.stringify({ p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId }), cache: "no-store" });
  if (!response.ok) return failure("編集内容を取得できませんでした。", 503);
  const listing = await response.json();
  if (!listing || typeof listing !== "object") return failure("この店舗の掲載編集は、運営の本人確認後に利用できます。", 403);
  return NextResponse.json({ ok: true, listing }, { headers: noStore });
}

export async function PATCH(request: NextRequest) {
  const c = await context(request); if ("error" in c) return c.error;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("下書き内容を確認してください。", 400); }
  const expected = Number(body.expectedRevision); const draft = payload(body);
  if (!Number.isSafeInteger(expected) || expected < 1 || !draft) return failure("下書き内容を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/save_partner_canonical_listing_draft`, { method: "POST", headers: c.headers, body: JSON.stringify({ p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId, p_expected_revision: expected, p_patch: { shop_name: draft.shop_name, area_name: draft.area, official_url: draft.website_url, introduction: draft.introduction, banner_asset_id: draft.banner_asset_id } }), cache: "no-store" });
  if (!response.ok) return failure("下書きを保存できませんでした。", 503);
  const result = await response.json();
  if (result === "forbidden") return failure("この店舗の編集権限がありません。", 403);
  if (result !== "ok") return failure("ほかの編集または審査が反映されました。再読み込みしてください。", 409);
  return NextResponse.json({ ok: true, message: "下書きを保存しました。公開内容は変更されていません。" }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const c = await context(request); if ("error" in c) return c.error;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("申請内容を確認してください。", 400); }
  const expected = Number(body.expectedRevision);
  if (!Number.isSafeInteger(expected) || expected < 1) return failure("申請内容を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/submit_partner_canonical_listing_change`, { method: "POST", headers: c.headers, body: JSON.stringify({ p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId, p_expected_revision: expected }), cache: "no-store" });
  if (!response.ok) return failure("変更申請を送信できませんでした。", 503);
  const result = await response.json();
  if (result === "forbidden") return failure("この店舗の編集権限がありません。", 403);
  if (result !== "ok") return failure("ほかの編集または審査が反映されました。再読み込みしてください。", 409);
  return NextResponse.json({ ok: true, message: "変更を申請しました。運営の承認まで公開内容は変わりません。" }, { headers: noStore });
}
