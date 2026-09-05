import { AreaDepthStaticRoute } from "@/components/area/AreaDepthStaticRoute";
import { generateAreaHubRouteMetadata } from "@/components/area/AreaHubRouteContent";

type Props = { searchParams: Promise<{ page?: string }> };

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export async function generateMetadata({ searchParams }: Props) {
  const { page } = await searchParams;
  return generateAreaHubRouteMetadata("shinosaka", parsePage(page));
}

export default function ShinosakaAreaPage() {
  return <AreaDepthStaticRoute slug="shinosaka" />;
}
