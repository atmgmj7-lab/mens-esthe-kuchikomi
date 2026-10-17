import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_ACCESS_CONTEXT_COOKIE, isPublicAccessEventKind, isPublicAccessShopSlug, issuePublicAccessContext, publicAccessNetworkScopeHash, resolvePublicAccessContextSession, verifyPublicAccessContext } from "@/lib/analytics/public-access-context";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403, headers });
  const shopSlug = request.nextUrl.searchParams.get("shopSlug");
  const eventKind = request.nextUrl.searchParams.get("eventKind");
  if (!isPublicAccessShopSlug(shopSlug) || !isPublicAccessEventKind(eventKind)) return new NextResponse(null, { status: 400, headers });
  const session = resolvePublicAccessContextSession(request.cookies.get(PUBLIC_ACCESS_CONTEXT_COOKIE)?.value);
  const context = session && issuePublicAccessContext({ shopSlug, eventKind, sessionHash: session.sessionHash });
  if (!context) return new NextResponse(null, { status: 204, headers });
  const verified = verifyPublicAccessContext({ context, shopSlug, eventKind });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!verified || !base || !secret) return new NextResponse(null, { status: 204, headers });
  const reserved = await fetch(`${base}/rest/v1/rpc/reserve_public_shop_access_context_v11`, {
    method: "POST",
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
    body: JSON.stringify({ p_shop_slug: shopSlug, p_session_scope_hash: verified.sessionScopeHash, p_network_scope_hash: publicAccessNetworkScopeHash(request.headers.get("x-forwarded-for")), p_is_new_session: session.isNew }),
    cache: "no-store",
  }).catch(() => null);
  if (!reserved?.ok) return new NextResponse(null, { status: reserved?.status === 429 ? 429 : 204, headers: reserved?.status === 429 ? { ...headers, "Retry-After": "600" } : headers });
  const response = NextResponse.json({ context }, { headers });
  response.cookies.set(PUBLIC_ACCESS_CONTEXT_COOKIE, session.cookieValue, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 48 });
  return response;
}
