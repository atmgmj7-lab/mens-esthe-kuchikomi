import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Analytics | Eskomi 管理ダッシュボード",
  description: "認証済み運用者向けの集計Analytics画面",
  robots: {
    index: false,
    follow: false
  },
};

export default function DashboardAnalyticsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
