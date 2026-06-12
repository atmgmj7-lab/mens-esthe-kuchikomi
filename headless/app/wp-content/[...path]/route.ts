import { requestWpOrigin } from "@/lib/wp/origin-request";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "content-disposition"
] as const;

const DEFAULT_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

async function proxyWpContent(request: NextRequest, context: RouteContext, method: "GET" | "HEAD") {
  const { path } = await context.params;
  const targetPath = path.join("/");
  const search = request.nextUrl.search;
  const pathWithSearch = `/wp-content/${targetPath}${search}`;

  const response = await requestWpOrigin(pathWithSearch, { method });

  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  if (!response.headers.get("cache-control") && response.status >= 200 && response.status < 300) {
    headers.set("cache-control", DEFAULT_CACHE_CONTROL);
  }

  return new NextResponse(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyWpContent(request, context, "GET");
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyWpContent(request, context, "HEAD");
}
