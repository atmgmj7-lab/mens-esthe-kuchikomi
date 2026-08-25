import "server-only";

import { authorizeDashboardRequest, type DashboardAuthorization } from "@/lib/dashboard/content-admin-auth";
import { getAnalyticsSnapshot } from "@/lib/analytics/snapshot-cache";
import type { AnalyticsSnapshot } from "@/lib/analytics/snapshot";
import type { AnalyticsDays } from "@/lib/analytics/period";

const protectedHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Type": "application/json; charset=utf-8",
};

type HandlerDependencies = Readonly<{
  authorize: (authorization: string | null) => DashboardAuthorization;
  collect: (options: { days: AnalyticsDays }) => Promise<AnalyticsSnapshot>;
}>;

function error(status: number): Response {
  return Response.json({ error: "analytics_request_failed" }, { status, headers: protectedHeaders });
}

function parsedDays(url: URL): AnalyticsDays | null {
  const entries = [...url.searchParams.entries()];
  if (entries.length !== 1 || entries[0][0] !== "period") return null;
  return entries[0][1] === "7" ? 7 : entries[0][1] === "28" ? 28 : null;
}

export function createAnalyticsCurrentHandler(dependencies: HandlerDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    const authorization = dependencies.authorize(request.headers.get("authorization"));
    if (!authorization.ok) return error(authorization.status);
    const days = parsedDays(new URL(request.url));
    if (days === null) return error(400);
    try {
      return Response.json(await dependencies.collect({ days }), { status: 200, headers: protectedHeaders });
    } catch {
      return error(500);
    }
  };
}

const productionHandler = createAnalyticsCurrentHandler({
  authorize: (authorization) => authorizeDashboardRequest(authorization, process.env),
  collect: ({ days }) => getAnalyticsSnapshot({ days }),
});

export async function GET(request: Request): Promise<Response> {
  return productionHandler(request);
}
