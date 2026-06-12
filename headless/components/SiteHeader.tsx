import Link from "next/link";

const HEADER_LOGO = "/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png";

export function SiteHeader() {
  return (
    <header className="l-header hl-header">
      <div className="l-container">
        <Link className="l-header__logo hl-header__logo" href="/">
          <img src={HEADER_LOGO} alt="Escomi（エスコミ）" width={120} height={32} />
        </Link>
        <nav aria-label="メインナビゲーション">
          <ul className="c-gnav hl-gnav">
            <li>
              <Link href="/contact/">お問い合わせ</Link>
            </li>
            <li>
              <Link href="/about/">運営者情報</Link>
            </li>
            <li>
              <Link href="/storelisting/">掲載について</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
