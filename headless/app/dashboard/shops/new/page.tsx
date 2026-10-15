import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ManagedShopCreateForm } from "@/components/dashboard/ManagedShopForms";

export const metadata: Metadata = pageMetadata({ title: "店舗を追加", description: "Operator向け店舗追加の入力契約", path: "/dashboard/shops/new/", robots: { index: false, follow: false } });

export default function DashboardNewShopPage() {
  return <ManagedShopCreateForm />;
}
