import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { revalidateOperatorShopPublicCaches } from "@/lib/dashboard/operator-shop-public-cache";
import { managedShopDirectoryRepository, type ManagedShopPayload } from "@/lib/supabase/managed-shop-directory";
import { getWordPressShopById } from "@/lib/wp/shops";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const actorLabel = "dashboard-operator";
const fail = (message: string, status: 400 | 401 | 403 | 404 | 409 | 503) => NextResponse.json({ ok: false, message }, { status, headers });

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function allowed(request: NextRequest) {
  const authorization = authorizeDashboardRequest(request.headers.get("authorization"), process.env);
  if (!authorization.ok) return authorization.status;
  const site = request.headers.get("sec-fetch-site");
  return request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === "application/json"
    && (site === null || site === "same-origin")
    && hasSameOrigin(request)
    && request.headers.get("x-eskomi-csrf") === "managed-shop-write" ? 200 : 403;
}

function payload(value: unknown): ManagedShopPayload | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ManagedShopPayload : null;
}

function legacyPayload(shop: NonNullable<Awaited<ReturnType<typeof getWordPressShopById>>>): ManagedShopPayload | null {
  const primary = shop.primaryArea ?? shop.terms.find((term) => term.slug === shop.areaSlug) ?? shop.terms[0];
  const areaSlug = primary?.slug ?? shop.areaSlug;
  const areaName = primary?.name;
  if (!areaSlug || !areaName) return null;
  const string = (key: string) => typeof shop.acf[key] === "string" ? shop.acf[key] : null;
  const price = (key: string) => {
    const value = shop.acf[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : null;
  };
  return {
    shop_name: shop.title, area_slug: areaSlug, area_name: areaName, official_url: shop.officialUrl || null,
    introduction: shop.excerpt || null, address: string("shop_address"), business_hours: string("shop_hours"), phone: string("shop_tel"),
    line_url: string("shop_line"), booking_url: string("shop_booking_url"), basic_price: price("basic_price"), price_90: price("price_90"),
    banner_asset_id: null, gallery_asset_ids: [],
  };
}

async function revalidateManagedShop(managedShopId: string): Promise<void> {
  const detail = await managedShopDirectoryRepository.getDetail(managedShopId);
  const shop = detail && typeof detail.shop === "object" && detail.shop !== null ? detail.shop as Record<string, unknown> : null;
  const slug = typeof shop?.shop_slug === "string" ? shop.shop_slug : null;
  if (slug) revalidateOperatorShopPublicCaches(slug, { revalidateTag, revalidatePath });
  else {
    revalidateTag("wp", { expire: 0 });
    revalidatePath("/sitemap.xml");
  }
}

export async function POST(request: NextRequest) {
  const status = allowed(request);
  if (status !== 200) return fail(status === 401 ? "管理画面の認証が必要です。" : "この操作は受け付けられません。", status as 401 | 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return fail("入力内容を確認してください。", 400); }
  if (!managedShopDirectoryRepository.configured()) return fail("店舗管理のサーバー設定を確認してください。", 503);

  if (body.action === "import_legacy") {
    const wpShopId = Number(body.wpShopId);
    if (!Number.isSafeInteger(wpShopId) || wpShopId < 1) return fail("既存店舗を確認してください。", 400);
    const shop = await getWordPressShopById(wpShopId);
    if (!shop) return fail("既存店舗を確認できません。", 404);
    const initial = legacyPayload(shop);
    if (!initial) return fail("既存店舗のエリアを確認してから管理対象にしてください。", 409);
    const id = await managedShopDirectoryRepository.importLegacy({ wpShopId, slug: shop.slug, payload: initial, actorLabel });
    return id ? NextResponse.json({ ok: true, managedShopId: id }, { headers }) : fail("既存店舗を管理データへ取り込めませんでした。", 503);
  }

  if (body.action === "create") {
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const value = payload(body.payload);
    const id = value ? await managedShopDirectoryRepository.create({ slug, payload: value, actorLabel }) : null;
    return id ? NextResponse.json({ ok: true, managedShopId: id }, { headers }) : fail("新規店舗を下書きとして作成できませんでした。", 400);
  }

  const managedShopId = typeof body.managedShopId === "string" ? body.managedShopId : "";
  const expectedRevision = Number(body.expectedRevision);
  if (body.action === "save") {
    const value = payload(body.payload);
    const result = value ? await managedShopDirectoryRepository.saveDraft({ managedShopId, expectedRevision, payload: value, actorLabel }) : null;
    if (result === "ok") return NextResponse.json({ ok: true, state: result }, { headers });
    return fail(result === "conflict" ? "他の変更があります。再読込してからやり直してください。" : "下書きを保存できませんでした。", result === "conflict" ? 409 : 400);
  }
  if (body.action === "submit") {
    const result = await managedShopDirectoryRepository.submit({ managedShopId, expectedRevision, actorLabel });
    if (result === "ok") return NextResponse.json({ ok: true, state: result }, { headers });
    return fail(result === "conflict" ? "下書きが更新されています。再読込してください。" : "申請できませんでした。", result === "conflict" ? 409 : 400);
  }
  if (body.action === "review") {
    const decision = body.decision === "approved" || body.decision === "changes_requested" ? body.decision : null;
    const note = typeof body.note === "string" ? body.note : null;
    const result = decision ? await managedShopDirectoryRepository.review({ managedShopId, expectedRevision, decision, note, actorLabel }) : null;
    if (result === "ok") {
      await revalidateManagedShop(managedShopId);
      return NextResponse.json({ ok: true, state: result }, { headers });
    }
    return fail(result === "conflict" ? "対象の下書きが更新されています。再読込してください。" : "審査結果を保存できませんでした。", result === "conflict" ? 409 : 400);
  }
  if (body.action === "visibility") {
    const visibility = body.visibility === "published" || body.visibility === "unlisted" ? body.visibility : null;
    const result = visibility ? await managedShopDirectoryRepository.setVisibility({ managedShopId, expectedRevision, visibility, actorLabel }) : null;
    if (result === "ok") {
      await revalidateManagedShop(managedShopId);
      return NextResponse.json({ ok: true, state: result }, { headers });
    }
    return fail(result === "conflict" ? "公開状態が更新されています。再読込してください。" : "公開状態を変更できませんでした。", result === "conflict" ? 409 : 400);
  }
  return fail("操作を確認してください。", 400);
}
