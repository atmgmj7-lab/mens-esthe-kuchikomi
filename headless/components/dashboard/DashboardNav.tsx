"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DASHBOARD_NAV_GROUPS } from "@/lib/dashboard/navigation";
import styles from "./DashboardShell.module.css";

function normalizePathname(value: string): string {
  return value === "/" ? value : `${value.replace(/\/+$/, "")}/`;
}

export default function DashboardNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const normalizedPathname = normalizePathname(pathname);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) firstLinkRef.current?.focus();
  }, [isOpen]);

  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <aside className={styles.sidebar} aria-label="管理ダッシュボードのメニュー">
      <div className={styles.mobileBar}>
        <span className={styles.mobileBrand}>Eskomi 管理</span>
        <button
          ref={toggleRef}
          type="button"
          className={styles.menuButton}
          aria-controls="dashboard-navigation"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span aria-hidden="true">{isOpen ? "×" : "☰"}</span>
          <span>{isOpen ? "閉じる" : "メニュー"}</span>
        </button>
      </div>

      {isOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="メニューを閉じる"
          onClick={closeAndRestoreFocus}
          tabIndex={-1}
        />
      )}

      <nav
        id="dashboard-navigation"
        className={`${styles.navigation} ${isOpen ? styles.navigationOpen : ""}`}
        aria-label="管理ダッシュボード"
        onKeyDown={(event) => {
          if (event.key === "Escape") closeAndRestoreFocus();
        }}
      >
        <div className={styles.navIdentity}>
          <span className={styles.navMark} aria-hidden="true">E</span>
          <div>
            <strong>Eskomi</strong>
            <small>Growth Command</small>
          </div>
        </div>

        {DASHBOARD_NAV_GROUPS.map((group) => (
          <section key={group.label} className={styles.navGroup}>
            <h2>{group.label}</h2>
            <ul>
              {group.items.map((item, index) => {
                const isCurrent = normalizedPathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      ref={index === 0 ? firstLinkRef : undefined}
                      href={item.href}
                      className={styles.navLink}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <a
          href="https://mens-esthe-kuchikomi.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.publicLink}
        >
          公開サイトを確認
          <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </aside>
  );
}
