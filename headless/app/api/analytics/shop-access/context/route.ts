import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_ACCESS_CONTEXT_COOKIE, isPublicAccessEventKind, isPublicAccessShopSlug, issuePublicAccessContext, publicAccessContextSession } from "@/lib/analytics/public-access-context";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403, headers });
  const shopSlug = request.nextUrl.searchParams.get("shopSlug");
  const eventKind = request.nextUrl.searchParams.get("eventKind");
  if (!isPublicAccessShopSlug(shopSlug) || !isPublicAccessEventKind(eventKind)) return new NextResponse(null, { status: 400, headers });
  const session = publicAccessContextSession(request.cookies.get(PUBLIC_ACCESS_CONTEXT_COOKIE)?.value);
  const context = issuePublicAccessContext({ shopSlug, eventKind, session });
  if (!context) return new NextResponse(null, { status: 204, headers });
  const response = NextResponse.json({ context }, { headers });
  response.cookies.set(PUBLIC_ACCESS_CONTEXT_COOKIE, session, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 48 });
  return response;
}
