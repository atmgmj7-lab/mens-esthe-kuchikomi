import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, canonicalUrl } from "@/lib/seo";

const WP_THEME_STYLES = [
  "/wp-content/themes/swell_child/css/base.css",
  "/wp-content/themes/swell_child/css/front-page.css",
  "/wp-content/themes/swell_child/css/single.css"
] as const;

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
  const isDashboardRoute = headers().get("x-dashboard-route") === "1";

  return (
    <html lang="ja">
      <head>
        {!isDashboardRoute &&
          WP_THEME_STYLES.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
      </head>
      <body>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        {!isDashboardRoute ? <SiteHeader /> : null}
        {children}
        {!isDashboardRoute ? <SiteFooter /> : null}
      </body>
    </html>
  );
}
