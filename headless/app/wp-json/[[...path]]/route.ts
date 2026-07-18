import { requestWpOrigin } from "@/lib/wp/origin-request";
import {
  buildDailyUpdateRequest,
  buildWpProxyResponse,
} from "@/lib/wp/daily-update-proxy";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function proxyPublicWpJson(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "HEAD",
) {
  const { path = [] } = await context.params;
  const targetPath = path.join("/");
  const search = request.nextUrl.search;
  const suffix = targetPath ? `/${targetPath}` : "";
  const pathWithSearch = `/wp-json${suffix}${search}`;

  const response = await requestWpOrigin(pathWithSearch, {
    method,
    headers: new Headers(),
  });

  return buildWpProxyResponse(response, method);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyPublicWpJson(request, context, "GET");
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyPublicWpJson(request, context, "HEAD");
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const result = await buildDailyUpdateRequest({
    request,
    targetPath: path.join("/"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status: result.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const response = await requestWpOrigin(result.pathWithSearch, {
    method: "POST",
    headers: result.headers,
    body: result.body,
  });

  return buildWpProxyResponse(response, "POST");
}
