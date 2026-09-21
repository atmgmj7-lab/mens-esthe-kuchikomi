import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";

import { PartnerCopyButton } from "@/components/partner/PartnerCopyButton";
import { buildPartnerWidgetIframeSnippet } from "@/lib/partner/partner-review-widget";
import { PARTNER_SESSION_COOKIE, authorizePartnerReviewGrowthSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const instant = false;

export const metadata: Metadata = pageMetadata({
  title: "パートナーダッシュボード",
  description: "Eskomi Free Official Partner向けダッシュボード",
  path: "/partner/",
  robots: { index: false, follow: false },
});

export default async function PartnerDashboardPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const dashboard = await authorizePartnerReviewGrowthSession({ accessToken });
  if (dashboard.status !== "allowed") redirect("/partner/login/");
  const { identity, growthKit } = dashboard;
  const partnerStatus = identity.state === "free_official_partner" ? "Free Official Partner" : "Active Partner";
  const qrDataUrl = growthKit.qr.status === "available"
    ? await QRCode.toDataURL(growthKit.qr.value, { errorCorrectionLevel: "M", margin: 1, width: 512 })
    : null;
  const widgetEmbed = growthKit.widgetUrl.status === "available"
    ? buildPartnerWidgetIframeSnippet({ shopName: identity.shopName, widgetUrl: growthKit.widgetUrl.value })
    : null;

  return (
    <main id="main_content" className="l-mainContent l-article" data-partner-dashboard-root>
      <div className="l-mainContent__inner hl-page-inner">
        <header className="hl-contact-section">
          <p>Eskomi Partner Dashboard</p>
          <h1 className="hl-contact-heading">{identity.shopName}</h1>
          <p>現在のログイン先店舗を確認できます。</p>
          <nav aria-label="パートナーナビゲーション">
            <a href="/partner/" aria-current="page">ダッシュボード</a>
            {" · "}
            <a href={identity.canonicalUrl}>公開店舗ページ</a>
          </nav>
        </header>

        <section className="hl-contact-section" aria-labelledby="partner-shop-identity-heading">
          <h2 id="partner-shop-identity-heading" className="hl-contact-heading">店舗 identity</h2>
          <dl>
            <dt>Eskomi 店舗</dt>
            <dd>{identity.shopName}</dd>
            <dt>店舗 ID</dt>
            <dd>{identity.shopId}</dd>
            <dt>Partner workspace</dt>
            <dd>この店舗に紐づく workspace</dd>
          </dl>
        </section>

        <section className="hl-contact-section" aria-labelledby="partner-status-heading">
          <h2 id="partner-status-heading" className="hl-contact-heading">Partner status</h2>
          <p>{partnerStatus}</p>
        </section>

        <section className="hl-contact-section hl-partner-growth-kit" aria-labelledby="partner-growth-kit-heading">
          <h2 id="partner-growth-kit-heading" className="hl-contact-heading">Review Growth Kit</h2>
          <p>公開用の口コミ案内は、この店舗に紐づく既存Campaignだけを表示します。</p>

          <section aria-labelledby="partner-review-url-heading">
            <h3 id="partner-review-url-heading">口コミURL</h3>
            {growthKit.reviewUrl.status === "available" ? <>
              <p className="hl-partner-growth-kit__value">{growthKit.reviewUrl.value}</p>
              <PartnerCopyButton label="口コミURL" value={growthKit.reviewUrl.value} />
            </> : <p>利用できません。</p>}
          </section>

          <section aria-labelledby="partner-qr-heading">
            <h3 id="partner-qr-heading">QR</h3>
            {qrDataUrl && growthKit.qr.status === "available" ? <>
              <img className="hl-partner-growth-kit__qr" src={qrDataUrl} alt="口コミURLのQRコード" width={256} height={256} />
              <p><a href={qrDataUrl} download="eskomi-review-qr.png">QRをダウンロード</a></p>
            </> : <p>利用できません。</p>}
          </section>

          <section aria-labelledby="partner-line-message-heading">
            <h3 id="partner-line-message-heading">LINE案内文</h3>
            {growthKit.lineMessage.status === "available" ? <>
              <p className="hl-partner-growth-kit__message">{growthKit.lineMessage.value}</p>
              <PartnerCopyButton label="LINE案内文" value={growthKit.lineMessage.value} />
            </> : <p>利用できません。</p>}
          </section>

          <section aria-labelledby="partner-website-cta-heading">
            <h3 id="partner-website-cta-heading">Webサイト用Review CTA</h3>
            {growthKit.websiteCta.status === "available" ? <>
              <p><code className="hl-partner-growth-kit__value">{growthKit.websiteCta.value}</code></p>
              <PartnerCopyButton label="Webサイト用CTA" value={growthKit.websiteCta.value} />
            </> : <p>利用できません。</p>}
          </section>

          <section aria-labelledby="partner-widget-heading">
            <h3 id="partner-widget-heading">店舗サイトに口コミWidgetを設置</h3>
            <p>設置は任意です。</p>
            {growthKit.widgetUrl.status === "available" && widgetEmbed ? <>
              <p><a href={growthKit.widgetUrl.value} target="_blank" rel="noreferrer">Widgetを確認</a></p>
              <p><code className="hl-partner-growth-kit__value">{widgetEmbed}</code></p>
              <PartnerCopyButton label="Widgetコード" value={widgetEmbed} />
              <p><a href="#partner-widget-install-guide">設置方法を見る</a></p>
            </> : <p>利用できません。</p>}
          </section>

          <section id="partner-widget-install-guide" aria-labelledby="partner-widget-install-guide-heading">
            <h3 id="partner-widget-install-guide-heading">Widgetの設置方法</h3>
            <p>店舗サイトの任意の表示位置に貼り付けます。</p>
            <ol>
              <li>「Widgetを確認」で対象店舗の表示を確認します。</li>
              <li>「Widgetコードをコピー」でiframeコードをコピーします。</li>
              <li>店舗サイトのHTML編集が可能な位置へ貼り付け、スマートフォンでも表示を確認します。</li>
            </ol>
          </section>
        </section>

        <section className="hl-contact-section" aria-labelledby="partner-review-metrics-heading">
          <h2 id="partner-review-metrics-heading" className="hl-contact-heading">口コミ状況</h2>
          {growthKit.reviewMetrics.status === "available" ? <dl className="hl-partner-growth-kit__metrics">
            <dt>submitted</dt><dd>{growthKit.reviewMetrics.submitted}</dd>
            <dt>pending</dt><dd>{growthKit.reviewMetrics.pending}</dd>
            <dt>published</dt><dd>{growthKit.reviewMetrics.published}</dd>
          </dl> : <p>利用できません。</p>}
        </section>

        <section className="hl-contact-section" aria-labelledby="partner-campaign-metrics-heading">
          <h2 id="partner-campaign-metrics-heading" className="hl-contact-heading">Review campaign</h2>
          {growthKit.campaignMetrics.status === "available" ? <dl className="hl-partner-growth-kit__metrics">
            {growthKit.campaignMetrics.value.map((campaign) => <div key={campaign.channel}>
              <dt>{campaign.channel}</dt><dd>open: {campaign.open} / conversion: {campaign.conversion}</dd>
            </div>)}
          </dl> : <p>利用できません。</p>}
        </section>
      </div>
    </main>
  );
}
