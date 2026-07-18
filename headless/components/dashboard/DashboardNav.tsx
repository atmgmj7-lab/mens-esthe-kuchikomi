"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DASHBOARD_NAV_GROUPS } from "@/lib/dashboard/navigation";
import styles from "./DashboardShell.module.css";

function normalizePathname(value: string): string {
  return value === "/" ? value : `${value.replace(/\/+$/, "")}/`;
}

export default function DashboardNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const hasMountedRef = useRef(false);
  const previousPathnameRef = useRef(pathname);
  const normalizedPathname = normalizePathname(pathname);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    setIsOpen(false);
    const frame = requestAnimationFrame(() => {
      document.getElementById("dashboard-main")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    navigationRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
  }, [isOpen]);

  const closeAndRestoreFocus = useCallback(() => {
    setIsOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndRestoreFocus();
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [closeAndRestoreFocus, isOpen]);

  return (
    <aside className={styles.sidebar} aria-label="管理ダッシュボードのメニュー">
      <div className={styles.mobileBar}>
        <span className={styles.mobileBrand}>Eskomi 管理</span>
        <button
          ref={toggleRef}
          data-dashboard-menu-toggle
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
        ref={navigationRef}
        id="dashboard-navigation"
        data-open={isOpen}
        className={`${styles.navigation} ${isOpen ? styles.navigationOpen : ""}`}
        aria-label="管理ダッシュボード"
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
              {group.items.map((item) => {
                const isCurrent = normalizedPathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
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
