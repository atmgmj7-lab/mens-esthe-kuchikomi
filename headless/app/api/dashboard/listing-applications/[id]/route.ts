import { NextRequest, NextResponse } from "next/server";
import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f-]{36}$/i;
const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
function response(message: string, status: 400 | 401 | 404 | 409 | 503) { return NextResponse.json({ ok: false, message }, { status, headers: noStore }); }
function safeText(value: unknown, max: number) { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null; }
function validUrl(value: unknown) { const text = safeText(value, 2048); try { return text && ["http:", "https:"].includes(new URL(text).protocol) ? new URL(text).toString() : null; } catch { return null; } }
async function context(request: NextRequest) {
  const auth = authorizeDashboardRequest(request.headers.get("authorization"), process.env); if (!auth.ok) return { error: response(auth.status === 401 ? "管理画面の認証が必要です。" : "管理画面の設定を確認してください。", auth.status) } as const;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret(); if (!base || !secret) return { error: response("管理画面の設定を確認してください。", 503) } as const;
  return { base, headers: createSupabaseServerHeaders(secret.value, { "Accept-Profile": "private", "Content-Profile": "private" }) } as const;
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; if (!UUID.test(id)) return response("申請を確認してください。", 400); const c = await context(request); if ("error" in c) return c.error;
  const h = c.headers; const application = await fetch(`${c.base}/rest/v1/listing_applications?id=eq.${id}&select=*`, { headers: h, cache: "no-store" });
  if (!application.ok) return response("申請を取得できませんでした。", 503); const applications = await application.json(); if (!Array.isArray(applications) || !applications[0]) return response("申請が見つかりません。", 404);
  const [revisions, reviews, assets] = await Promise.all([
    fetch(`${c.base}/rest/v1/listing_application_revisions?application_id=eq.${id}&select=revision,public_payload,created_at&order=revision.desc`, { headers: h, cache: "no-store" }),
    fetch(`${c.base}/rest/v1/listing_application_reviews?application_id=eq.${id}&select=expected_revision,decision,reviewer_label,note,created_at&order=created_at.desc`, { headers: h, cache: "no-store" }),
    fetch(`${c.base}/rest/v1/listing_application_assets?application_id=eq.${id}&select=id,content_type,byte_size,width,height,created_at&order=created_at.desc`, { headers: h, cache: "no-store" }),
  ]);
  return NextResponse.json({ ok: true, application: applications[0], revisions: revisions.ok ? await revisions.json() : [], reviews: reviews.ok ? await reviews.json() : [], assets: assets.ok ? await assets.json() : [] }, { headers: noStore });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; if (!UUID.test(id)) return response("申請を確認してください。", 400); const c = await context(request); if ("error" in c) return c.error;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return response("編集内容を確認してください。", 400); }
  const expected = Number(body.expectedRevision); const shopName = safeText(body.shopName, 120); const area = safeText(body.area, 120); const websiteUrl = validUrl(body.websiteUrl); const introduction = typeof body.introduction === "string" && body.introduction.trim().length <= 5000 ? body.introduction.trim() : null; const editPreference = body.editPreference === "operator" || body.editPreference === "shop" ? body.editPreference : null;
  if (!Number.isSafeInteger(expected) || expected < 1 || !shopName || !area || !websiteUrl || !editPreference || (typeof body.introduction === "string" && !introduction && body.introduction.trim())) return response("編集内容を確認してください。", 400);
  const result = await fetch(`${c.base}/rest/v1/rpc/update_listing_application`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", "Content-Profile": "api" }, body: JSON.stringify({ p_application_id: id, p_expected_revision: expected, p_payload: { shop_name: shopName, area, website_url: websiteUrl, introduction, edit_preference: editPreference } }), cache: "no-store" });
  if (!result.ok) return response("編集を保存できませんでした。", 503); if (await result.json() !== "ok") return response("ほかの確認者が内容を更新しました。再読み込みして確認してください。", 409);
  return NextResponse.json({ ok: true, message: "確認待ちの編集内容を保存しました。公開内容は承認まで変わりません。" }, { headers: noStore });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; if (!UUID.test(id)) return response("申請を確認してください。", 400); const c = await context(request); if ("error" in c) return c.error;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return response("判断内容を確認してください。", 400); }
  const expected = Number(body.expectedRevision); const decision = body.decision; const note = typeof body.note === "string" && body.note.trim().length <= 5000 ? body.note.trim() : null;
  if (!Number.isSafeInteger(expected) || expected < 1 || !["approved", "changes_requested", "rejected"].includes(String(decision))) return response("判断内容を確認してください。", 400);
  const result = await fetch(`${c.base}/rest/v1/rpc/review_listing_application`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", "Content-Profile": "private" }, body: JSON.stringify({ p_application_id: id, p_expected_revision: expected, p_decision: decision, p_reviewer_label: "dashboard_listing_operator", p_note: note }), cache: "no-store" });
  if (!result.ok) return response("判断を保存できませんでした。", 503); if (await result.json() !== "ok") return response("ほかの確認者が内容を更新しました。再読み込みして確認してください。", 409);
  return NextResponse.json({ ok: true, message: decision === "approved" ? "承認しました。承認済みの公開候補だけが表示されます。" : "判断を保存しました。" }, { headers: noStore });
}
