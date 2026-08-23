import { NextRequest, NextResponse } from "next/server";

import {
  authorizeDashboardRequest,
  isDashboardProtectedPath,
} from "@/lib/dashboard/content-admin-auth";

const LEGACY_DASHBOARD_PREFIX = "/wp-content/themes/swell_child/dashboard";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isDashboardProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authorization = authorizeDashboardRequest(
    request.headers.get("authorization"),
    process.env,
  );
  if (authorization.status === 503) {
    return serviceUnavailableResponse();
  }
  if (authorization.status === 401) {
    return unauthorizedResponse();
  }

  if (pathname === LEGACY_DASHBOARD_PREFIX || pathname.startsWith(`${LEGACY_DASHBOARD_PREFIX}/`)) {
    const legacyPath = pathname.slice(LEGACY_DASHBOARD_PREFIX.length);
    const isLegacyApiOrAsset = legacyPath.startsWith("/api/") || legacyPath.includes(".");
    if (isLegacyApiOrAsset) {
      return continueDashboardRequest(request.headers);
    }

    const dashboardPath = !legacyPath || legacyPath === "/" ? "/dashboard" : `/dashboard${legacyPath}`;
    const redirectTo = new URL(`${dashboardPath}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(redirectTo);
  }

  return continueDashboardRequest(request.headers);
}

function continueDashboardRequest(headers: Headers): NextResponse {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("x-dashboard-route", "1");
  const response = NextResponse.next({ request: { headers: nextHeaders } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function securityHeaders(): Headers {
  const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return headers;
}

function serviceUnavailableResponse(): NextResponse {
  return new NextResponse("管理画面の認証設定を確認してください", {
    status: 503,
    headers: securityHeaders(),
  });
}

function unauthorizedResponse(): NextResponse {
  const headers = securityHeaders();
  headers.set("WWW-Authenticate", 'Basic realm="Dashboard"');
  return new NextResponse("認証が必要です", {
    status: 401,
    headers,
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",
    "/wp-content/themes/swell_child/dashboard",
    "/wp-content/themes/swell_child/dashboard/:path*",
  ],
};
