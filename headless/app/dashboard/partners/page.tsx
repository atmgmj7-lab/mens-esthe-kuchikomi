import type { Metadata } from "next";
import { DashboardPartnerWorkspace } from "@/components/dashboard/DashboardPartnerWorkspace";
import { pageMetadata } from "@/lib/seo";
import { getAllShopsForListing } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "Free Official Partner 管理",
  description: "Eskomi運営向けPartner workspace管理",
  path: "/dashboard/partners/",
  robots: { index: false, follow: false },
});

export default async function DashboardPartnersPage() {
  const shops = await getAllShopsForListing();
  return <DashboardPartnerWorkspace shops={shops.map((shop) => ({ id: shop.id, slug: shop.slug, title: shop.title }))} />;
}
