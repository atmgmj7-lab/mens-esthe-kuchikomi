import { NextRequest, NextResponse } from "next/server";

function isDashboardPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/wp-content/themes/swell_child/dashboard")
  );
}

function isDashboardStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/_next/") ||
    pathname === "/dashboard/favicon.ico" ||
    pathname === "/wp-content/themes/swell_child/dashboard/favicon.ico"
  );
}

function isBasicAuthEnabled(): boolean {
  return Boolean(process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isDashboardPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/wp-content/themes/swell_child/dashboard")) {
    const legacyPath = pathname.replace("/wp-content/themes/swell_child/dashboard", "");
    const isLegacyApiOrAsset =
      legacyPath.startsWith("/api/") ||
      legacyPath.includes(".");

    if (isLegacyApiOrAsset) {
      return NextResponse.next();
    }

    if (!legacyPath || legacyPath === "/") {
      const redirectTo = new URL("/dashboard", request.url);
      return NextResponse.redirect(redirectTo);
    }

    const nextPath = `/dashboard${legacyPath}`;
    const redirectTo = new URL(`${nextPath}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(redirectTo);
  }

  if (isDashboardStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (!isBasicAuthEnabled()) {
    return NextResponse.next({
      request: { headers: setDashboardRouteHeader(request.headers) },
    });
  }

  const authorization = request.headers.get("authorization") || "";
  const [scheme, encoded] = authorization.split(" ");

  if (!scheme || scheme.toLowerCase() !== "basic" || !encoded) {
    return unauthorizedResponse();
  }

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorizedResponse();
  }
  const delimiterIndex = decoded.indexOf(":");
  const user = delimiterIndex >= 0 ? decoded.slice(0, delimiterIndex) : "";
  const password = delimiterIndex >= 0 ? decoded.slice(delimiterIndex + 1) : "";

  if (user !== process.env.BASIC_AUTH_USER || password !== process.env.BASIC_AUTH_PASSWORD) {
    return unauthorizedResponse();
  }

  return NextResponse.next({
    request: { headers: setDashboardRouteHeader(request.headers) },
  });
}

function setDashboardRouteHeader(headers: Headers): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("x-dashboard-route", "1");
  return nextHeaders;
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse("認証が必要です", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Dashboard"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/wp-content/themes/swell_child/dashboard",
    "/wp-content/themes/swell_child/dashboard/:path*"
  ],
};
