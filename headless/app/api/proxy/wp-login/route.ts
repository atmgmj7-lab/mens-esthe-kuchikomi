import { buildWpAdminProxyResponse } from "@/lib/wp/admin-proxy-response";
import { requestWpOrigin } from "@/lib/wp/origin-request";
import { NextRequest } from "next/server";

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

  return buildWpAdminProxyResponse(response, method);
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
