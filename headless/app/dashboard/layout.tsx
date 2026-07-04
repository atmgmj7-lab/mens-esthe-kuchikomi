import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
    <div className={`${geistSans.variable} ${geistMono.variable} min-h-full`}>
      <style jsx global>{`
        body {
          background: #0a0a0a;
          color: #ededed;
          font-family: Arial, Helvetica, sans-serif;
        }
        .l-header,
        .hl-header,
        .l-footer,
        .hl-footer,
        #wpadminbar {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  );
}
