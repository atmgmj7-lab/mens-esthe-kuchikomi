import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = {
  title: "WP ダッシュボード | mens-esthe-kuchikomi",
  description: "mens-esthe-kuchikomi.com 管理ダッシュボード",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dashboard-app">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
