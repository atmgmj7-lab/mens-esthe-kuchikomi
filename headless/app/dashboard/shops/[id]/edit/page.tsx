import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OperatorListingExclusionForm, OperatorShopFactEditForm } from "@/components/dashboard/OperatorShopForms";
import { getOperatorShopDetail, getOperatorShopFactSnapshot } from "@/lib/dashboard/operator-shop-projection";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "店舗情報を編集", description: "Operator向け店舗編集の入力契約", path: "/dashboard/shops/", robots: { index: false, follow: false } });
export const instant = false;

export default async function DashboardShopEditPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await connection();
  const id = Number((await params).id);
  const [record, factSnapshot] = await Promise.all([getOperatorShopDetail(id), getOperatorShopFactSnapshot(id)]);
  if (!record || !factSnapshot) notFound();
  return <>
    <p><a href={`/dashboard/shops/${record.publicShop.wpShopId}/`}>← {record.publicShop.title} の詳細へ戻る</a></p>
    <OperatorShopFactEditForm snapshot={factSnapshot} />
    <OperatorListingExclusionForm wpShopId={record.publicShop.wpShopId} />
  </>;
}
