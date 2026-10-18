import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { inspectListingImage } from "@/lib/listing-application-image";
import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { managedShopDirectoryRepository } from "@/lib/supabase/managed-shop-directory";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f-]{36}$/i;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const fail = (message: string, status: 400 | 401 | 403 | 404 | 503) => NextResponse.json({ ok: false, message }, { status, headers });

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!auth.ok) return fail("管理画面の認証が必要です。", auth.status === 503 ? 503 : 401);
  if ((request.headers.get("sec-fetch-site") !== null && request.headers.get("sec-fetch-site") !== "same-origin") || !hasSameOrigin(request) || request.headers.get("x-eskomi-csrf") !== "managed-shop-write") return fail("この操作は受け付けられません。", 403);
  const managedShopId = (await params).id;
  if (!UUID.test(managedShopId)) return fail("店舗を確認してください。", 404);
  let form: FormData; try { form = await request.formData(); } catch { return fail("画像を選択してください。", 400); }
  const candidate = form.get("image"); if (!(candidate instanceof File)) return fail("画像を選択してください。", 400);
  const image = await inspectListingImage(candidate); if (!image.ok) return fail(image.error, 400);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!base || !secret || !managedShopDirectoryRepository.configured()) return fail("画像保存のサーバー設定を確認してください。", 503);
  const assetId = randomUUID(); const extension = "jpg";
  const objectKey = `managed-shops/${managedShopId}/${assetId}.${extension}`;
  const body = image.bytes.buffer.slice(image.bytes.byteOffset, image.bytes.byteOffset + image.bytes.byteLength) as ArrayBuffer;
  const stored = await fetch(`${base}/storage/v1/object/listing-application-private/${objectKey}`, { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": image.type, "x-upsert": "false" }), body: new Blob([body], { type: image.type }) });
  if (!stored.ok) return fail("画像を保存できませんでした。", 503);
  const recorded = await managedShopDirectoryRepository.attachAsset({ managedShopId, assetId, objectKey, sha256: image.sha256, contentType: image.type, byteSize: image.bytes.length, width: image.width, height: image.height, actorLabel: "dashboard-operator" });
  if (recorded) return NextResponse.json({ ok: true, assetId: recorded }, { headers });
  await fetch(`${base}/storage/v1/object/listing-application-private/${objectKey}`, { method: "DELETE", headers: createSupabaseServerHeaders(secret.value) }).catch(() => undefined);
  return fail("画像情報を保存できませんでした。", 503);
}
