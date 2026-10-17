import { NextRequest, NextResponse } from "next/server";

import { inspectListingImage } from "@/lib/listing-application-image";
import { partnerTherapistNoStore, partnerTherapistRequestContext } from "@/lib/partner/therapist-tools-server";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const failure = (message: string, status: 400 | 401 | 403 | 503) =>
  NextResponse.json({ ok: false, message }, { status, headers: partnerTherapistNoStore });

export async function POST(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("この店舗の写真を登録できません。", c.status === "unavailable" ? 503 : c.status === "unauthenticated" ? 401 : 403);
  let form: FormData; try { form = await request.formData(); } catch { return failure("写真を選択してください。", 400); }
  const photo = form.get("photo"); if (!(photo instanceof File)) return failure("写真を選択してください。", 400);
  const image = await inspectListingImage(photo); if (!image.ok) return failure(image.error, 400);
  const secret = resolveSupabaseServerSecret(); if (!secret) return failure("写真を保存できませんでした。", 503);
  const reserved = await fetch(`${c.base}/rest/v1/rpc/reserve_partner_therapist_photo_upload`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_content_type: image.type }), cache: "no-store",
  });
  const objectKey = reserved.ok ? await reserved.json() as unknown : null;
  if (typeof objectKey !== "string" || !objectKey.startsWith(`therapists/${c.workspaceId}/`)) return failure("写真アップロードを開始できませんでした。", 403);
  const body = image.bytes.buffer.slice(image.bytes.byteOffset, image.bytes.byteOffset + image.bytes.byteLength) as ArrayBuffer;
  const stored = await fetch(`${c.base}/storage/v1/object/listing-application-private/${objectKey}`, {
    method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": image.type, "x-upsert": "false" }), body: new Blob([body], { type: image.type }),
  });
  if (!stored.ok) return failure("写真を保存できませんでした。", 503);
  const attached = await fetch(`${c.base}/rest/v1/rpc/attach_partner_therapist_photo`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_object_key: objectKey, p_sha256: image.sha256, p_content_type: image.type, p_byte_size: image.bytes.length, p_width: image.width, p_height: image.height }), cache: "no-store",
  });
  const assetId = attached.ok ? await attached.json() as unknown : null;
  if (typeof assetId === "string") return NextResponse.json({ ok: true, assetId }, { headers: partnerTherapistNoStore });
  await fetch(`${c.base}/storage/v1/object/listing-application-private/${objectKey}`, { method: "DELETE", headers: createSupabaseServerHeaders(secret.value) }).catch(() => undefined);
  return failure("写真情報を保存できませんでした。", 503);
}
