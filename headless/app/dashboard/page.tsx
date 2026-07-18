import type { Metadata } from "next";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "WP ダッシュボード",
  description: "mens-esthe-kuchikomi.com 管理ダッシュボード",
  path: "/dashboard/",
  robots: {
    index: false,
    follow: false
  }
});

export default function DashboardPage() {
  return <AnalyticsDashboard />;
}
