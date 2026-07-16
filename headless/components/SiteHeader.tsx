"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/shops/", label: "店舗を探す" },
  { href: "/area/osaka/", label: "エリアから探す" },
  { href: "/reviews/submit/", label: "口コミについて" },
  { href: "/storelisting/", label: "掲載について" }
] as const;

export function SiteHeader() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <header className="l-header hl-header escomi-final-site-header">
      <div className="l-container escomi-final-site-header__inner">
        <Link className="l-header__logo hl-header__logo" href="/">
          <span className="escomi-final-site-header__brand-text">
            Eskomi<span aria-hidden="true">.</span>
          </span>
          <span className="escomi-final-site-header__tagline">関西メンズエステ口コミナビ</span>
        </Link>
        <nav className="escomi-final-site-header__nav" aria-label="メインナビゲーション">
          <ul className="c-gnav hl-gnav">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link className="escomi-final-site-header__search" href="/shops/">
                検索
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
