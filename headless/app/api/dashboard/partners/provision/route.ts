import { NextRequest, NextResponse } from "next/server";
import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { provisionPartnerWorkspace, nextPartnerAction } from "@/lib/partner/provisioning-service";
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
  const shop = await getShopBySlug(body.shopSlug.trim());
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
