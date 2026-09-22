import type { Metadata } from "next";
import { connection } from "next/server";
import { OperatorShopsList } from "@/components/dashboard/OperatorShops";
import { getOperatorShopPage } from "@/lib/dashboard/operator-shop-projection";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "店舗管理", description: "Eskomi運営向け店舗管理", path: "/dashboard/shops/", robots: { index: false, follow: false } });
export const instant = false;

type Props = Readonly<{ searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }>;

function first(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function pageNumber(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : undefined; }

export default async function DashboardShopsPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const data = await getOperatorShopPage({ query: first(params.q), page: pageNumber(first(params.page)) });
  return <OperatorShopsList data={data} />;
}
