import "server-only";

import { authorizeDashboardRequest } from "@/lib/dashboard/content-admin-auth";
import { getAnalyticsSnapshot } from "@/lib/analytics/snapshot-cache";
import { createAnalyticsCurrentHandler } from "@/lib/analytics/current-handler";

const productionHandler = createAnalyticsCurrentHandler({
  authorize: (authorization) => authorizeDashboardRequest(authorization, process.env),
  collect: ({ days }) => getAnalyticsSnapshot({ days }),
});

export async function GET(request: Request): Promise<Response> {
  return productionHandler(request);
}
