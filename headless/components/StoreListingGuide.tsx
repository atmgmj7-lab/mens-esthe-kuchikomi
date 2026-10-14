import Link from "next/link";

const banners = [
  { label: "横長 728 × 90", href: "/downloads/eskomi-link-banner-728x90.svg", width: 728, height: 90 },
  { label: "横長 468 × 60", href: "/downloads/eskomi-link-banner-468x60.svg", width: 468, height: 60 },
  { label: "レクタングル 300 × 250", href: "/downloads/eskomi-link-banner-300x250.svg", width: 300, height: 250 },
] as const;

export function StoreListingGuide() {
  return (
    <section id="listing-actions" className="hl-listing-guide" aria-labelledby="listing-actions-heading">
      <div className="hl-listing-guide__heading">
        <p className="hl-static-page-kicker">FOR STORE OWNERS</p>
        <h2 id="listing-actions-heading" className="hl-contact-heading">状況に合う窓口を選ぶ</h2>
        <p>掲載・修正・口コミ対応は、それぞれ確認できる操作だけを分けてご案内します。申請内容や口コミが自動で公開されることはありません。</p>
      </div>

      <div className="hl-listing-guide__actions">
        <article className="hl-listing-guide__action">
          <p className="hl-listing-guide__number">01</p>
          <h3>新しく掲載を希望する</h3>
          <p>店舗名や公式情報を添えて、掲載希望・情報修正フォームからご相談ください。掲載可否や内容は運営が確認します。</p>
          <Link href="/contact/#contact-form-heading" className="hl-listing-guide__button">掲載希望を問い合わせる</Link>
        </article>
        <article className="hl-listing-guide__action">
          <p className="hl-listing-guide__number">02</p>
          <h3>掲載中の情報を確認・更新する</h3>
          <p>まず店舗一覧から対象ページを開き、「掲載情報を登録・修正する」を選んでください。対象店舗を確認できた場合だけ申請フォームを表示します。</p>
          <Link href="/shops/" className="hl-listing-guide__button">掲載中の店舗を探す</Link>
        </article>
        <article className="hl-listing-guide__action">
          <p className="hl-listing-guide__number">03</p>
          <h3>招待済みの担当者</h3>
          <p>登録済みメールアドレスへログイン用リンクを送信し、口コミURL・QR・掲載情報の確認導線を利用できます。</p>
          <Link href="/partner/login/" className="hl-listing-guide__button">パートナーログインへ</Link>
        </article>
      </div>

      <section className="hl-listing-guide__banner" aria-labelledby="listing-banner-heading">
        <div>
          <p className="hl-static-page-kicker">OPTIONAL LINK BANNER</p>
          <h3 id="listing-banner-heading">サイト紹介用バナー</h3>
          <p>相互リンクは任意です。掲載順位や審査結果には影響しません。ご自身で管理するページにだけ設置してください。</p>
        </div>
        <ul className="hl-listing-guide__banner-list">
          {banners.map((banner) => (
            <li key={banner.href}>
              <img className="hl-listing-guide__banner-preview" src={banner.href} alt="Eskomi（エスコミ）紹介用バナーのプレビュー" width={banner.width} height={banner.height} />
              <a href={banner.href} download>{banner.label}をダウンロード</a>
            </li>
          ))}
        </ul>
        <details className="hl-listing-guide__html">
          <summary>安全なHTML設置例を見る</summary>
          <p>画像のURLとリンク先は Eskomi の正規URLです。JavaScript、計測用パラメータ、隠しリンクは含みません。</p>
          <pre><code>{`<a href="https://mens-esthe-kuchikomi.com/storelisting/" target="_blank" rel="noopener noreferrer">
  <img src="https://mens-esthe-kuchikomi.com/downloads/eskomi-link-banner-${banners[0].width}x${banners[0].height}.svg" width="${banners[0].width}" height="${banners[0].height}" alt="Eskomi（エスコミ）｜関西メンズエステの店舗情報・口コミ">
</a>`}</code></pre>
        </details>
      </section>
    </section>
  );
}
