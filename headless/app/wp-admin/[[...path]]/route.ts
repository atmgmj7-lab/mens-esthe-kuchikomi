import { requestWpOrigin } from "@/lib/wp/origin-request";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "set-cookie",
  "location",
  "refresh",
  "content-disposition"
] as const;

function buildUpstreamHeaders(request: NextRequest, contentType?: string | null): Headers {
  const headers = new Headers();

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return headers;
}

function buildProxyResponse(response: Response, method: string) {
  const headers = new Headers();

  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  // WordPress管理画面を検索インデックスから除外
  headers.set("x-robots-tag", "noindex, nofollow");
  // 管理画面はキャッシュしない
  headers.set("cache-control", "no-cache, no-store, must-revalidate");

  return new NextResponse(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function proxyWpAdmin(request: NextRequest, context: RouteContext, method: "GET" | "HEAD" | "POST") {
  const { path = [] } = await context.params;
  const targetPath = path.join("/");
  const search = request.nextUrl.search;
  const suffix = targetPath ? `/${targetPath}` : "";
  const pathWithSearch = `/wp-admin${suffix}${search}`;

  let body: ArrayBuffer | null = null;
  if (method === "POST") {
    body = await request.arrayBuffer();
  }

  const response = await requestWpOrigin(pathWithSearch, {
    method,
    headers: buildUpstreamHeaders(request, method === "POST" ? request.headers.get("content-type") : null),
    body,
    forwardCookies: true
  });

  return buildProxyResponse(response, method);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyWpAdmin(request, context, "GET");
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyWpAdmin(request, context, "HEAD");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyWpAdmin(request, context, "POST");
}
