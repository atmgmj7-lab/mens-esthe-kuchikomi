import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, canonicalUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: "%s | Escomi"
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: canonicalUrl("/")
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: canonicalUrl("/"),
    siteName: "Escomi",
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
