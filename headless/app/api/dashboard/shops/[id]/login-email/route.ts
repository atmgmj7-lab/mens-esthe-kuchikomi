import { NextRequest, NextResponse } from "next/server";

import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { normalizePartnerLoginEmail } from "@/lib/partner/partner-login-email";
import { getOperatorPartnerLoginEmailManagement, setOperatorPartnerLoginEmailIntent } from "@/lib/partner/partner-login-email-service";
import { getShopById } from "@/lib/wp/shops";

function response(message: string, status: number) {
  return NextResponse.json({ ok: status < 400, message }, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

async function canonicalShop(id: number) {
  const shop = await getShopById(id);
  return shop ? { wpShopId: shop.id, shopSlug: shop.slug, canonicalUrl: `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/` } : null;
}

export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return response("認証が必要です。", authorization.status);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return response("店舗を確認できません。", 404);
  const shop = await canonicalShop(id);
  if (!shop) return response("店舗を確認できません。", 404);
  const management = await getOperatorPartnerLoginEmailManagement(shop);
  if (management.status === "unavailable") return response("ログインメールの状態を確認できません。", 503);
  return NextResponse.json({ ok: true, status: management.status, email: management.email, intent: management.intent }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function POST(request: NextRequest, { params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return response("認証が必要です。", authorization.status);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return response("店舗を確認できません。", 404);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > 2_048) return response("入力内容を確認してください。", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return response("入力内容を確認してください。", 400); }
  const email = normalizePartnerLoginEmail(body && typeof body === "object" && "email" in body ? body.email : null);
  const action = body && typeof body === "object" && "action" in body ? body.action : null;
  if (!email || (action !== "operator_initial" && action !== "operator_change_requested")) return response("入力内容を確認してください。", 400);
  const shop = await canonicalShop(id);
  if (!shop) return response("店舗を確認できません。", 404);
  const saved = await setOperatorPartnerLoginEmailIntent(shop, email, action);
  if (saved.status !== "available") return response("安全に記録できませんでした。WorkspaceとMembershipの状態を確認してください。", 409);
  return response(action === "operator_initial" ? "初期ログインメールを記録しました。AuthユーザーやMembershipは作成していません。" : "ログインメールの変更依頼を記録しました。AuthユーザーやMembershipは変更していません。", 202);
}
