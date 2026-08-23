import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Analytics | Eskomi 管理ダッシュボード",
  description: "認証済み運用者向けの集計Analytics画面",
  path: "/dashboard/analytics/",
  robots: {
    index: false,
    follow: false
  },
});

export default function DashboardAnalyticsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
