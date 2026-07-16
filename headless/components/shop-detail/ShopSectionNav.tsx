"use client";

import { useEffect, useState } from "react";
import type { ShopSectionLink } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopSectionNav({ links }: { links: ShopSectionLink[] }) {
  const [activeId, setActiveId] = useState<ShopSectionLink["id"] | null>(null);

  useEffect(() => {
    const linkIds = new Set(links.map((link) => link.id));
    const visibleSections = new Map<ShopSectionLink["id"], number>();
    const updateFromHash = () => {
      const hash = window.location.hash.slice(1) as ShopSectionLink["id"];
      setActiveId(linkIds.has(hash) ? hash : null);
    };
    const sections = links
      .map((link) => document.getElementById(link.id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
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
      { rootMargin: "-112px 0px -60% 0px", threshold: [0, 0.1, 0.5] }
    );

    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);
    for (const section of sections) observer.observe(section);

    return () => {
      window.removeEventListener("hashchange", updateFromHash);
      observer.disconnect();
    };
  }, [links]);

  if (links.length === 0) return null;

  return (
    <nav className={styles.sectionNav} aria-label="店舗詳細のページ内メニュー">
      <div className={styles.sectionNavList}>
        {links.map((link) => (
          <a
            key={link.id}
            className={styles.sectionNavLink}
            href={`#${link.id}`}
            aria-current={activeId === link.id ? "location" : undefined}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
