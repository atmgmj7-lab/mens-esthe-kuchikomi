import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return new NextResponse(null, { status: 403, headers });
  let body: { shopSlug?: unknown; eventKind?: unknown };
  try { body = await request.json() as { shopSlug?: unknown; eventKind?: unknown }; } catch { return new NextResponse(null, { status: 400, headers }); }
  if (typeof body.shopSlug !== "string" || !/^[^/\s\\\u0000-\u001f]+$/u.test(body.shopSlug) || !["shop_view", "official_line_click"].includes(String(body.eventKind))) {
    return new NextResponse(null, { status: 400, headers });
  }
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return new NextResponse(null, { status: 204, headers });
  const result = await fetch(`${base}/rest/v1/rpc/record_public_shop_access_v11`, {
    method: "POST",
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
    body: JSON.stringify({ p_shop_slug: body.shopSlug, p_event_kind: body.eventKind }),
    cache: "no-store",
  }).catch(() => null);
  return new NextResponse(null, { status: result?.ok ? 204 : 204, headers });
}
