import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OperatorListingExclusionForm, OperatorShopWriteForm } from "@/components/dashboard/OperatorShopForms";
import { getOperatorShopDetail } from "@/lib/dashboard/operator-shop-projection";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "店舗情報を編集", description: "Operator向け店舗編集の入力契約", path: "/dashboard/shops/", robots: { index: false, follow: false } });
export const instant = false;

export default async function DashboardShopEditPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await connection();
  const id = Number((await params).id);
  const record = await getOperatorShopDetail(id);
  if (!record) notFound();
  return <>
    <p><a href={`/dashboard/shops/${record.publicShop.wpShopId}/`}>← {record.publicShop.title} の詳細へ戻る</a></p>
    <OperatorShopWriteForm mode="update" wpShopId={record.publicShop.wpShopId} initialValue={{
      title: record.publicShop.title,
      area: record.publicShop.areaName ?? "",
      officialUrl: record.publicShop.officialUrl,
      publicationState: record.publicShop.publicationStatus === "publish" ? "publish" : "draft",
    }} />
    <OperatorListingExclusionForm wpShopId={record.publicShop.wpShopId} />
  </>;
}
