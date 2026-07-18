"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopSectionLink } from "@/lib/shop-detail-modules";
import styles from "./ShopDetail.module.css";

export function ShopSectionNav({ links }: { links: ShopSectionLink[] }) {
  const [activeId, setActiveId] = useState<ShopSectionLink["id"] | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (links.length === 0) return;

    const navElement = navRef.current;
    const shopRoot = navElement?.closest<HTMLElement>("[data-shop-detail-root]");
    if (!navElement || !shopRoot) return;

    const siteHeader = document.querySelector<HTMLElement>(".escomi-final-site-header");
    const linkIds = new Set(links.map((link) => link.id));
    const visibleSections = new Map<ShopSectionLink["id"], number>();
    const sections = links
      .map((link) => document.getElementById(link.id))
      .filter((section): section is HTMLElement => Boolean(section));
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let sectionScrollOffset = -1;

    const updateFromHash = () => {
      const hash = window.location.hash.slice(1) as ShopSectionLink["id"];
      setActiveId(linkIds.has(hash) ? hash : null);
    };

    const observeCurrentSection = () => {
      observer?.disconnect();
      visibleSections.clear();
      if (typeof IntersectionObserver === "undefined") return;

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.id as ShopSectionLink["id"];
            if (!linkIds.has(id)) continue;
            if (entry.isIntersecting) visibleSections.set(id, entry.boundingClientRect.top);
            else visibleSections.delete(id);
          }
          const currentId = [...visibleSections.entries()].sort(
            (first, second) => first[1] - second[1]
          )[0]?.[0];
          setActiveId(currentId ?? null);
        },
        {
          rootMargin: `-${sectionScrollOffset}px 0px -60% 0px`,
          threshold: [0, 0.1, 0.5]
        }
      );
      for (const section of sections) observer.observe(section);
    };

    const measureStickyOffsets = () => {
      const headerOffset = Math.max(
        0,
        Math.ceil(siteHeader?.getBoundingClientRect().height ?? 0)
      );
      const navHeight = Math.max(0, Math.ceil(navElement.getBoundingClientRect().height));
      const nextSectionScrollOffset = headerOffset + navHeight + 12;

      shopRoot.style.setProperty("--shop-site-header-offset", `${headerOffset}px`);
      shopRoot.style.setProperty(
        "--shop-section-scroll-offset",
        `${nextSectionScrollOffset}px`
      );
      if (sectionScrollOffset === nextSectionScrollOffset) return;
      sectionScrollOffset = nextSectionScrollOffset;
      observeCurrentSection();
    };

    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);
    window.addEventListener("resize", measureStickyOffsets);
    measureStickyOffsets();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measureStickyOffsets);
      if (siteHeader) resizeObserver.observe(siteHeader);
      resizeObserver.observe(navElement);
    }

    return () => {
      window.removeEventListener("hashchange", updateFromHash);
      window.removeEventListener("resize", measureStickyOffsets);
      observer?.disconnect();
      resizeObserver?.disconnect();
      shopRoot.style.removeProperty("--shop-site-header-offset");
      shopRoot.style.removeProperty("--shop-section-scroll-offset");
    };
  }, [links]);

  if (links.length === 0) return null;

  const primaryLinks = links.filter((link) => link.layer === "primary");
  const secondaryLinks = links.filter((link) => link.layer === "secondary");

  const renderLayer = (layerLinks: ShopSectionLink[], label: string) =>
    layerLinks.length > 0 ? (
      <div className={styles.sectionNavLayer} role="group" aria-label={label}>
        {layerLinks.map((link) => (
          <a
            key={link.id}
            className={styles.sectionNavLink}
            href={`#${link.id}`}
            aria-current={activeId === link.id ? "location" : undefined}
            onClick={() => setActiveId(link.id)}
          >
            {link.label}
          </a>
        ))}
      </div>
    ) : null;

  return (
    <nav ref={navRef} className={styles.sectionNav} aria-label="店舗詳細のページ内メニュー">
      <div className={styles.sectionNavList}>
        {renderLayer(primaryLinks, "主要項目")}
        {renderLayer(secondaryLinks, "詳細項目")}
      </div>
    </nav>
  );
}
