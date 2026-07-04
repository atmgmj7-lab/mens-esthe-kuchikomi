"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer className="l-footer hl-footer">
      <div className="hl-footer-divider" />
      <div className="mep-container hl-footer-inner">
        <div className="hl-profile-box">
          <span>プロフィール</span>
        </div>
        <nav className="hl-footer-nav" aria-label="フッターナビ">
          <Link href="/">ホーム</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/contact/">お問い合わせ</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/sitemap/">サイトマップ</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/storelisting/">掲載について</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/about/">運営者情報</Link>
        </nav>
        <p className="hl-footer-copy">© 関西メンズエステ口コミナビ エスコミ</p>
      </div>
      <a href="#main_content" className="hl-back-to-top" aria-label="ページトップへ">
        ↑
      </a>
    </footer>
  );
}
