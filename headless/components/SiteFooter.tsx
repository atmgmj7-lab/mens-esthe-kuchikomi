"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer className="l-footer hl-footer escomi-final-site-footer">
      <div className="hl-footer-divider" />
      <div className="mep-container hl-footer-inner">
        <div className="hl-profile-box escomi-final-site-footer__profile">
          <div>
            <p className="escomi-final-site-footer__brand">
              Eskomi<span aria-hidden="true">.</span>
            </p>
            <p className="escomi-final-site-footer__tagline">関西メンズエステ口コミナビ</p>
          </div>
          <p className="escomi-final-site-footer__lead">
            大阪・京都・兵庫を中心に、店舗情報、料金、営業時間、承認済み口コミを確認しやすく整理しています。
          </p>
          <p className="escomi-final-site-footer__policy">
            ユーザー口コミ、編集部コメント、店舗提供情報、PR情報は分けて掲載します。
          </p>
        </div>
        <nav className="hl-footer-nav" aria-label="フッターナビ">
          <Link href="/">ホーム</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/shops/">店舗を探す</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/area/osaka/">エリアから探す</Link>
          <span className="hl-footer-sep">|</span>
          <Link href="/reviews/submit/">口コミ投稿</Link>
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
