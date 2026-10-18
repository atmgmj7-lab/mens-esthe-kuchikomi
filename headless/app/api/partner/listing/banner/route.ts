import { NextRequest, NextResponse } from "next/server";
import { inspectListingImage } from "@/lib/listing-application-image";
import { authorizePartnerTherapistSession, PARTNER_SESSION_COOKIE } from "@/lib/partner/partner-session";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const fail = (message: string, status: 400 | 401 | 403 | 503) => NextResponse.json({ ok: false, message }, { status, headers });
export async function POST(request: NextRequest) {
  const session = await authorizePartnerTherapistSession({ accessToken: request.cookies.get(PARTNER_SESSION_COOKIE)?.value ?? null });
  if (session.status !== "allowed") return fail("この店舗の編集権限を確認できません。", session.status === "unavailable" ? 503 : 401);
  let form: FormData; try { form = await request.formData(); } catch { return fail("画像を選択してください。", 400); }
  const banner = form.get("banner"); if (!(banner instanceof File)) return fail("画像を選択してください。", 400);
  const image = await inspectListingImage(banner); if (!image.ok) return fail(image.error, 400);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return fail("画像を保存できませんでした。", 503);
  const rpcHeaders = createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" });
  const reserved = await fetch(`${base}/rest/v1/rpc/reserve_partner_canonical_listing_banner_upload`, { method: "POST", headers: rpcHeaders, body: JSON.stringify({ p_workspace_id: session.access.workspaceId, p_auth_user_id: session.access.authUserId, p_content_type: image.type }), cache: "no-store" });
  const objectKey = reserved.ok ? await reserved.json() as unknown : null;
  if (typeof objectKey !== "string" || !objectKey.startsWith("managed-shops/")) return fail("画像アップロードを開始できませんでした。", 403);
  const body = image.bytes.buffer.slice(image.bytes.byteOffset, image.bytes.byteOffset + image.bytes.byteLength) as ArrayBuffer;
  const stored = await fetch(`${base}/storage/v1/object/listing-application-private/${objectKey}`, { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": image.type, "x-upsert": "false" }), body: new Blob([body], { type: image.type }) });
  if (!stored.ok) return fail("画像を保存できませんでした。", 503);
  const attached = await fetch(`${base}/rest/v1/rpc/attach_partner_canonical_listing_banner_asset`, { method: "POST", headers: rpcHeaders, body: JSON.stringify({ p_workspace_id: session.access.workspaceId, p_auth_user_id: session.access.authUserId, p_object_key: objectKey, p_sha256: image.sha256, p_content_type: image.type, p_byte_size: image.bytes.length, p_width: image.width, p_height: image.height }), cache: "no-store" });
  const assetId = attached.ok ? await attached.json() as unknown : null;
  if (typeof assetId === "string") return NextResponse.json({ ok: true, assetId }, { headers });
  await fetch(`${base}/storage/v1/object/listing-application-private/${objectKey}`, { method: "DELETE", headers: createSupabaseServerHeaders(secret.value) }).catch(() => undefined);
  return fail("画像情報を保存できませんでした。", 503);
}
