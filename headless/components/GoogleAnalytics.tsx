"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GA_MEASUREMENT_ID, gaEvent, pageview } from "@/lib/gtag";
import { normalizePublicShopSlug } from "@/lib/shop-slug";

function isExternalHref(href: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("/") || href.startsWith("tel:")) {
    return false;
  }
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function isListingPath(pathname: string): boolean {
  return pathname.includes("/listing") || pathname.includes("/storelisting");
}

function classifyOutbound(href: string): string {
  try {
    const url = new URL(href);
    if (url.pathname.includes("/contact")) return "contact_click";
    if (isListingPath(url.pathname)) return "listing_click";
  } catch {
    return "outbound_click";
  }
  return "outbound_click";
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname.startsWith("/dashboard")) return;
    if (!GA_MEASUREMENT_ID) return;
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    pageview(url);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (pathname.startsWith("/dashboard")) return;
    if (!GA_MEASUREMENT_ID) return;

    const shopSlug = normalizePublicShopSlug(
      pathname.match(/^\/shops\/([^/]+)\/?$/)?.[1] || ""
    );
    if (shopSlug) {
      gaEvent("shop_view", {
        shop_slug: shopSlug,
        page_path: pathname
      });
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/dashboard")) return;
    if (!GA_MEASUREMENT_ID) return;

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href")?.trim() || "";
      if (!href) return;

      const ctaKind = anchor.getAttribute("data-shop-cta-kind") || "";
      const isShopCta = ["reservation", "line", "tel", "official", "owner"].includes(
        ctaKind
      );
      if (isShopCta) {
        const pathShopSlug = normalizePublicShopSlug(
          pathname.match(/^\/shops\/([^/]+)\/?$/)?.[1] || ""
        );
        const dataShopSlug = normalizePublicShopSlug(
          anchor.getAttribute("data-shop-slug") || ""
        );
        const shopSlug = dataShopSlug || pathShopSlug;
        const ctaPosition =
          anchor.getAttribute("data-shop-cta-position") || "unknown";
        const eventName =
          ctaKind === "official"
            ? "official_site_click"
            : ctaKind === "owner"
              ? "shop_owner_request_click"
              : "shop_reservation_click";

        gaEvent(eventName, {
          shop_slug: shopSlug,
          cta_kind: ctaKind,
          cta_position: ctaPosition,
          link_url: ctaKind === "tel" ? "tel:" : href,
          page_path: pathname
        });
        return;
      }

      if (href.startsWith("tel:")) {
        gaEvent("tel_click", {
          link_url: "tel:",
          page_path: pathname
        });
        return;
      }

      let normalizedPathname: string | null = null;
      try {
        normalizedPathname = new URL(href, window.location.origin).pathname;
      } catch {
        // ignore invalid href
      }

      if (normalizedPathname?.includes("/contact")) {
        gaEvent("contact_click", {
          link_url: href,
          link_text: (anchor.textContent || "").trim().slice(0, 100),
          page_path: pathname
        });
        return;
      }

      if (isListingPath(normalizedPathname || "")) {
        gaEvent("listing_click", {
          link_url: href,
          link_text: (anchor.textContent || "").trim().slice(0, 100),
          page_path: pathname
        });
        return;
      }

      if (!isExternalHref(href)) return;

      const action = classifyOutbound(href);
      const isOfficial =
        anchor.classList.contains("shpc-link-btn") ||
        anchor.textContent?.includes("公式") ||
        anchor.closest(".shop-data-table") !== null;

      gaEvent(isOfficial ? "official_site_click" : action, {
        link_url: href,
        link_text: (anchor.textContent || "").trim().slice(0, 100),
        page_path: pathname
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (pathname.startsWith("/dashboard")) return null;
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
