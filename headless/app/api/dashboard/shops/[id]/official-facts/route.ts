import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { type OperatorWriterField } from "@/lib/dashboard/operator-shop-fact-dry-run";
import { readOfficialFactsWriterEnvironment } from "@/lib/dashboard/official-facts-writer";
import { partnerShopFactsRepository, useSupabaseShopManagement } from "@/lib/supabase/partner-shop-facts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function response(message: string, status: 400 | 401 | 403 | 404 | 409 | 503) {
  return NextResponse.json({ ok: false, message }, { status, headers });
}

function isUpdates(value: unknown): value is Record<OperatorWriterField, string> {
  const allowed = new Set(["official_url", "basic_price", "shop_hours", "shop_address", "shop_tel", "shop_line", "shop_booking", "shop_holiday", "price_90", "shop_booking_url"]);
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length > 0 && Object.entries(value).every(([field, input]) => allowed.has(field) && typeof input === "string" && input.trim().length > 0);
}

/**
 * Browser input is allowed to ask for an approval check only. It cannot supply
 * canonical/provenance/audit evidence, cannot reach WP credentials, and cannot
 * write until the reviewed-evidence workflow is installed server-side.
 */
export async function POST(request: NextRequest, { params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return response("管理画面の認証が必要です。", authorization.status);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json"
    || (fetchSite !== null && fetchSite !== "same-origin")
    || request.headers.get("x-eskomi-csrf") !== "official-facts-write"
    || request.headers.get("origin") !== request.nextUrl.origin) return response("この操作は受け付けられません。", 403);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return response("店舗を確認できません。", 404);
  let body: unknown;
  try { body = await request.json(); } catch { return response("変更内容を確認してください。", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !isUpdates((body as { updates?: unknown }).updates)) {
    return response("変更内容を確認してください。", 400);
  }
  if (useSupabaseShopManagement()) {
    if (id !== 768) return response("このSupabase検証はMrs.Rank UPだけが対象です。", 404);
    const expectedRevision = (body as { expectedRevision?: unknown }).expectedRevision;
    if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 1) {
      return response("店舗情報を再読込して差分を確認してください。", 409);
    }
    const saved = await partnerShopFactsRepository.save({
      wpShopId: id,
      expectedRevision: expectedRevision as number,
      updates: (body as { updates: Record<OperatorWriterField, string> }).updates,
      actorLabel: "operator-dashboard",
    });
    if (saved.status === "conflict") {
      return NextResponse.json({ ok: false, message: "店舗情報が更新されています。再読込して差分を確認してください。", snapshot: saved.snapshot }, { status: 409, headers });
    }
    if (saved.status === "saved" || saved.status === "noop") {
      return NextResponse.json({
        ok: true,
        message: saved.status === "saved" ? "Supabaseの検証用正本へ保存し、再読込用snapshotを取得しました。" : "保存済み内容と同一です。",
        snapshot: saved.snapshot,
      }, { headers });
    }
    return response("Supabaseの検証用店舗情報を保存できませんでした。", 503);
  }
  if (!readOfficialFactsWriterEnvironment()) return response("限定Writerのサーバー設定を確認してください。", 503);

  // Deliberately fail closed: this route is not a provenance authoring API.
  // A later reviewed-evidence service may invoke OfficialFactsWriter directly.
  return response("確認済みの公式根拠・canonical・監査情報が未連携のため、保存は開始していません。", 409);
}

// Kept exported for the reviewed server workflow. It is never reached by the
// browser request above, so there is no accidental production write path.
export function revalidateOfficialFactsPublicCaches(slug: string) {
  revalidateTag("wp", { expire: 0 });
  revalidatePath(`/shops/${slug}`);
  revalidatePath("/sitemap.xml");
}
