import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";

import { PartnerCopyButton } from "@/components/partner/PartnerCopyButton";
import { resolvePartnerActionFirstHome } from "@/lib/partner/partner-dashboard";
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
  const home = resolvePartnerActionFirstHome(identity, growthKit);
  const asset = (key: (typeof home.collection)[number]["key"]) => home.collection.find((item) => item.key === key);
  const qrAsset = asset("qr");
  const qrDataUrl = qrAsset?.status === "available"
    ? await QRCode.toDataURL(qrAsset.value, { errorCorrectionLevel: "M", margin: 1, width: 512 })
    : null;
  const widgetAsset = asset("widget");
  const widgetEmbed = widgetAsset?.status === "available"
    ? buildPartnerWidgetIframeSnippet({ shopName: home.context.shopName, widgetUrl: widgetAsset.value })
    : null;
  const reviewUrlAsset = asset("review_url");
  const lineAsset = asset("line");
  const websiteCtaAsset = asset("website_cta");
  const unavailableMessage = (candidate: (typeof home.collection)[number] | undefined) =>
    candidate?.status === "unavailable" ? candidate.message : "利用できません。";

  return (
    <main id="main_content" className="l-mainContent l-article hl-partner-home" data-partner-dashboard-root>
      <div className="l-mainContent__inner hl-page-inner hl-partner-home__inner">
        <header className="hl-partner-home__context">
          <p className="hl-partner-home__eyebrow">Eskomi Partner</p>
          <div className="hl-partner-home__context-row">
            <div>
              <h1>{home.context.shopName}</h1>
              <p className="hl-partner-home__status">{home.context.partnerStatus}</p>
            </div>
            <div><a className="hl-partner-home__text-link" href={home.context.canonicalUrl}>公開店舗ページを確認</a><a className="hl-partner-home__text-link" href="/partner/settings/">ログインメール設定</a></div>
          </div>
        </header>

        <section className="hl-partner-home__action" aria-labelledby="partner-action-heading">
          <p className="hl-partner-home__eyebrow">Action Required</p>
          <h2 id="partner-action-heading">今やること</h2>
          <h3>{home.action.title}</h3>
          <p>{home.action.description}</p>
          <a className="hl-partner-home__primary-action" href={home.action.primaryAction.href}>{home.action.primaryAction.label}</a>
        </section>

        <section className="hl-partner-home__section" aria-labelledby="partner-review-performance-heading">
          <div className="hl-partner-home__section-heading">
            <div>
              <p className="hl-partner-home__eyebrow">Review Performance</p>
              <h2 id="partner-review-performance-heading">口コミ状況</h2>
            </div>
            <p className="hl-partner-home__period">集計：累計・この店舗</p>
          </div>
          {home.performance.status === "available" ? <dl className="hl-partner-home__metrics">
            {home.performance.metrics.map((metric) => <div key={metric.key} className="hl-partner-home__metric">
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>)}
          </dl> : <p className="hl-partner-home__unavailable" role="status">{home.performance.message}</p>}
        </section>

        <section id="partner-collect-reviews" className="hl-partner-home__section" aria-labelledby="partner-collect-reviews-heading">
          <div className="hl-partner-home__section-heading">
            <div>
              <p className="hl-partner-home__eyebrow">Collect Reviews</p>
              <h2 id="partner-collect-reviews-heading">口コミを集める</h2>
            </div>
            <p className="hl-partner-home__section-note">この店舗に紐づく既存Campaignだけを表示します。</p>
          </div>
          <div className="hl-partner-home__collection">
            <section className="hl-partner-home__asset" aria-labelledby="partner-review-url-heading">
              <h3 id="partner-review-url-heading">口コミURL</h3>
              {reviewUrlAsset?.status === "available" ? <><p className="hl-partner-growth-kit__value">{reviewUrlAsset.value}</p><PartnerCopyButton label="口コミURL" value={reviewUrlAsset.value} /></> : <p className="hl-partner-home__unavailable">{unavailableMessage(reviewUrlAsset)}</p>}
            </section>
            <section className="hl-partner-home__asset" aria-labelledby="partner-qr-heading">
              <h3 id="partner-qr-heading">QR</h3>
              {qrDataUrl && qrAsset?.status === "available" ? <><img className="hl-partner-growth-kit__qr" src={qrDataUrl} alt="口コミURLのQRコード" width={256} height={256} /><p><a className="hl-partner-home__text-link" href={qrDataUrl} download="eskomi-review-qr.png">QRをダウンロード</a></p></> : <p className="hl-partner-home__unavailable">{unavailableMessage(qrAsset)}</p>}
            </section>
            <section className="hl-partner-home__asset" aria-labelledby="partner-line-message-heading">
              <h3 id="partner-line-message-heading">LINE案内文</h3>
              {lineAsset?.status === "available" ? <><p className="hl-partner-growth-kit__message">{lineAsset.value}</p><PartnerCopyButton label="LINE案内文" value={lineAsset.value} /></> : <p className="hl-partner-home__unavailable">{unavailableMessage(lineAsset)}</p>}
            </section>
            <section className="hl-partner-home__asset" aria-labelledby="partner-website-cta-heading">
              <h3 id="partner-website-cta-heading">Webサイト用CTA</h3>
              {websiteCtaAsset?.status === "available" ? <><p><code className="hl-partner-growth-kit__value">{websiteCtaAsset.value}</code></p><PartnerCopyButton label="Webサイト用CTA" value={websiteCtaAsset.value} /></> : <p className="hl-partner-home__unavailable">{unavailableMessage(websiteCtaAsset)}</p>}
            </section>
            <section className="hl-partner-home__asset" aria-labelledby="partner-widget-heading">
              <h3 id="partner-widget-heading">口コミWidget</h3>
              <p>設置は任意です。</p>
              {widgetAsset?.status === "available" && widgetEmbed ? <><p><a className="hl-partner-home__text-link" href={widgetAsset.value} target="_blank" rel="noreferrer">Widgetを確認</a></p><p><code className="hl-partner-growth-kit__value">{widgetEmbed}</code></p><PartnerCopyButton label="Widgetコード" value={widgetEmbed} /></> : <p className="hl-partner-home__unavailable">{unavailableMessage(widgetAsset)}</p>}
            </section>
          </div>
        </section>

        <section className="hl-partner-home__section" aria-labelledby="partner-recent-activity-heading">
          <p className="hl-partner-home__eyebrow">Recent Activity</p>
          <h2 id="partner-recent-activity-heading">最近の動き</h2>
          <p className="hl-partner-home__unavailable" role="status">{home.recentActivity.message}</p>
        </section>
      </div>
    </main>
  );
}
