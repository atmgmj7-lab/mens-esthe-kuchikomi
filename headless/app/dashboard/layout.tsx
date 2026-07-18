import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DashboardShell from "@/components/dashboard/DashboardShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <div
      className={`${geistSans.variable} ${geistMono.variable} dashboard-app`}
    >
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
