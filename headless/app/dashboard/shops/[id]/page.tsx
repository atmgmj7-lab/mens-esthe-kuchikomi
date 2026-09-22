import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OperatorShopDetail } from "@/components/dashboard/OperatorShops";
import { OperatorPartnerLoginEmail } from "@/components/dashboard/OperatorPartnerLoginEmail";
import { getOperatorShopDetail } from "@/lib/dashboard/operator-shop-projection";
import { getOperatorPartnerLoginEmailManagement } from "@/lib/partner/partner-login-email-service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "店舗詳細", description: "Operator向け店舗統合詳細", path: "/dashboard/shops/", robots: { index: false, follow: false } });
export const instant = false;

export default async function DashboardShopDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await connection();
  const id = Number((await params).id);
  const record = await getOperatorShopDetail(id);
  if (!record) notFound();
  const loginEmail = await getOperatorPartnerLoginEmailManagement({
    wpShopId: record.publicShop.wpShopId,
    shopSlug: record.publicShop.slug,
    canonicalUrl: record.publicShop.canonicalUrl,
  });
  const { authUserId: _authUserId, ...safeLoginEmail } = loginEmail;
  return <><OperatorShopDetail record={record} /><OperatorPartnerLoginEmail shopId={record.publicShop.wpShopId} hasActiveMembership={loginEmail.authUserId !== null} initial={safeLoginEmail} /></>;
}
