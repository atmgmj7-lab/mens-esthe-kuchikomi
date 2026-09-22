import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OperatorShopDetail } from "@/components/dashboard/OperatorShops";
import { getOperatorShopDetail } from "@/lib/dashboard/operator-shop-projection";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "店舗詳細", description: "Operator向け店舗統合詳細", path: "/dashboard/shops/", robots: { index: false, follow: false } });
export const instant = false;

export default async function DashboardShopDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await connection();
  const id = Number((await params).id);
  const record = await getOperatorShopDetail(id);
  if (!record) notFound();
  return <OperatorShopDetail record={record} />;
}
