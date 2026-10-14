import Link from "next/link";

const reciprocalLinkTargetUrl = "https://mens-esthe-kuchikomi.com/";

/**
 * Only add entries after the reciprocal-link artwork has been supplied and reviewed.
 * Files are served through the existing public /downloads/ path; no placeholder link
 * is exposed while the artwork is unavailable.
 */
const reciprocalBanners: ReadonlyArray<Readonly<{ label: string; href: string; width: number; height: number }>> = [];

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
          <h3 id="listing-banner-heading">相互リンク用バナー</h3>
          <p>相互リンクは任意です。掲載順位や審査結果には影響しません。ご自身で管理するページにだけ設置してください。</p>
        </div>
        {reciprocalBanners.length === 0 ? (
          <div className="hl-listing-guide__banner-pending" role="status">
            <p><strong>準備中です。</strong> 正式な相互リンク用バナー画像の受領・確認後、この欄でプレビュー、ダウンロード、店舗サイトへの貼り付け用コードをご案内します。</p>
            <dl><div><dt>プレビュー</dt><dd>画像を準備中です</dd></div><div><dt>ダウンロード</dt><dd>配布できる画像はまだありません</dd></div><div><dt>貼り付け用コード</dt><dd>画像の公開後に表示します</dd></div></dl>
          </div>
        ) : <>
          <ul className="hl-listing-guide__banner-list">
            {reciprocalBanners.map((banner) => (
              <li key={banner.href}>
                <img className="hl-listing-guide__banner-preview" src={banner.href} alt="Eskomi（エスコミ）相互リンク用バナーのプレビュー" width={banner.width} height={banner.height} />
                <a href={banner.href} download>{banner.label}をダウンロード</a>
              </li>
            ))}
          </ul>
          <details className="hl-listing-guide__html">
            <summary>安全なHTML設置例を見る</summary>
            <p>画像のURLとリンク先は Eskomi の正規URLです。JavaScript、計測用パラメータ、隠しリンクは含みません。</p>
            <pre><code>{`<a href="${reciprocalLinkTargetUrl}" target="_blank" rel="noopener noreferrer">
  <img src="https://mens-esthe-kuchikomi.com${reciprocalBanners[0].href}" width="${reciprocalBanners[0].width}" height="${reciprocalBanners[0].height}" alt="Eskomi（エスコミ）｜関西メンズエステの店舗情報・口コミ">
</a>`}</code></pre>
          </details>
        </>}
      </section>
    </section>
  );
}
