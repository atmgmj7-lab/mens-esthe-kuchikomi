import { NextRequest, NextResponse } from "next/server";
import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { provisionPartnerWorkspace, nextPartnerAction } from "@/lib/partner/provisioning-service";
import { managedShopDirectoryRepository } from "@/lib/supabase/managed-shop-directory";
import { partnerWorkspaceRepository } from "@/lib/supabase/partner-workspace";
import { getShopBySlug } from "@/lib/wp/shops";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, message: "管理画面の認証が必要です。" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Dashboard"',
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  if (!authorizeDashboardRequest(request.headers.get("authorization"), process.env).ok) return unauthorized();
  let body: { shopSlug?: unknown };
  try {
    body = await request.json() as { shopSlug?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "店舗を選択してください。" }, { status: 400 });
  }
  if (typeof body.shopSlug !== "string" || !body.shopSlug.trim()) {
    return NextResponse.json({ ok: false, message: "店舗を選択してください。" }, { status: 400 });
  }
  const requestedSlug = body.shopSlug.trim();
  // A normal managed store has no WordPress record. Resolve it straight from
  // the canonical publication before using the legacy reader, including when
  // the public directory flag has deliberately not been enabled yet.
  const canonicalPublication = (await managedShopDirectoryRepository.listPublished())
    .find((publication) => publication.shop_slug === requestedSlug && publication.existing_wp_shop_id === null);
  const shop = canonicalPublication
    ? { id: canonicalPublication.directory_id, slug: canonicalPublication.shop_slug, title: canonicalPublication.shop_name }
    : await getShopBySlug(requestedSlug);
  if (!shop) return NextResponse.json({ ok: false, message: "対象店舗を確認できません。" }, { status: 400 });
  const workspace = await provisionPartnerWorkspace(shop, "operator", partnerWorkspaceRepository);
  if (!workspace) return NextResponse.json({ ok: false, message: "Partner workspaceを初期化できません。" }, { status: 503 });
  return NextResponse.json({
    ok: true,
    workspace: {
      id: workspace.id,
      state: workspace.state,
      initialized: workspace.initialized,
      nextAction: nextPartnerAction(workspace.state),
    },
  });
}
