import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "詳細分析",
  description: "mens-esthe-kuchikomi.com 管理ダッシュボードの詳細分析ページ",
  path: "/dashboard/analytics/",
  robots: {
    index: false,
    follow: false
  }
});

export default function DashboardAnalyticsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
