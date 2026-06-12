import { requestWpOrigin } from "@/lib/wp/origin-request";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "link",
  "x-wp-total",
  "x-wp-totalpages"
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

function buildProxyResponse(response: Response, method: "GET" | "HEAD" | "POST") {
  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  return new NextResponse(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function proxyWpJson(request: NextRequest, context: RouteContext, method: "GET" | "HEAD" | "POST") {
  const { path = [] } = await context.params;
  const targetPath = path.join("/");
  const search = request.nextUrl.search;
  const suffix = targetPath ? `/${targetPath}` : "";
  const pathWithSearch = `/wp-json${suffix}${search}`;

  const response = await requestWpOrigin(pathWithSearch, {
    method,
    headers: buildUpstreamHeaders(request, method === "POST" ? request.headers.get("content-type") : null),
    body: method === "POST" ? await request.arrayBuffer() : null
  });

  return buildProxyResponse(response, method);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyWpJson(request, context, "GET");
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyWpJson(request, context, "HEAD");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyWpJson(request, context, "POST");
}
