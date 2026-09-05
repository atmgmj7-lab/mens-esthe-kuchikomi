import { notFound } from "next/navigation";
import { renderAreaHubRouteContent } from "@/components/area/AreaHubRouteContent";
import { getAreaBySlug } from "@/lib/wp/areas";
import { withWpBuildFallback } from "@/lib/wp/build-resilience";

export async function AreaDepthStaticRoute({ slug }: { slug: "shinosaka" | "sakai" }) {
  const area = await withWpBuildFallback(`area page ${slug}`, () => getAreaBySlug(slug), null);
  if (!area) notFound();
  return renderAreaHubRouteContent(area, 1);
}
