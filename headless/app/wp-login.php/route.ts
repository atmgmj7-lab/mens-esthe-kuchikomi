import { requestWpOrigin } from "@/lib/wp/origin-request";
import { NextRequest, NextResponse } from "next/server";

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

  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("cache-control", "no-cache, no-store, must-revalidate");

  return new NextResponse(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function proxyWpLogin(request: NextRequest, method: "GET" | "HEAD" | "POST") {
  const search = request.nextUrl.search;
  const pathWithSearch = `/wp-login.php${search}`;

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

export async function GET(request: NextRequest) {
  return proxyWpLogin(request, "GET");
}

export async function HEAD(request: NextRequest) {
  return proxyWpLogin(request, "HEAD");
}

export async function POST(request: NextRequest) {
  return proxyWpLogin(request, "POST");
}
