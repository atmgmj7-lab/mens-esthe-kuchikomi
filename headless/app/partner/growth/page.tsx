import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";

import { PartnerCopyButton } from "@/components/partner/PartnerCopyButton";
import { buildPartnerWidgetIframeSnippet } from "@/lib/partner/partner-review-widget";
import { resolvePartnerReviewGrowthCenter } from "@/lib/partner/partner-review-growth-kit";
import { PARTNER_SESSION_COOKIE, authorizePartnerReviewGrowthSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const instant = false;

export const metadata: Metadata = pageMetadata({
  title: "口コミを集める | パートナー",
  description: "Eskomi Partner向けの口コミ導線",
  path: "/partner/growth/",
  robots: { index: false, follow: false },
});

export default async function PartnerReviewGrowthCenterPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const dashboard = await authorizePartnerReviewGrowthSession({ accessToken });
  if (dashboard.status !== "allowed") redirect("/partner/login/");
  const center = resolvePartnerReviewGrowthCenter(dashboard.identity, dashboard.metrics);
  if (center.status !== "allowed") redirect("/partner/login/");
  const asset = (key: (typeof center.assets)[number]["key"]) => center.assets.find((item) => item.key === key);
  const qr = asset("qr");
  const qrDataUrl = qr?.status === "available"
    ? await QRCode.toDataURL(qr.value, { errorCorrectionLevel: "M", margin: 1, width: 512 })
    : null;
  const widget = asset("widget");
  const widgetSnippet = widget?.status === "available"
    ? buildPartnerWidgetIframeSnippet({ shopName: center.context.shopName, widgetUrl: widget.value })
    : null;
  const unavailable = (candidate: (typeof center.assets)[number] | undefined) =>
    candidate?.status === "available" ? null : candidate ?? { status: "unavailable" as const, message: "この導線は利用できません。", prerequisite: "時間をおいて再度確認してください。" };
  const reviewUrl = asset("review_url");
  const line = asset("line");
  const websiteCta = asset("website_cta");

  return <main id="main_content" className="l-mainContent l-article hl-partner-home hl-partner-growth-center" data-partner-growth-center-root>
    <div className="l-mainContent__inner hl-page-inner hl-partner-home__inner">
      <header className="hl-partner-home__context">
        <p className="hl-partner-home__eyebrow">Review Growth Center</p>
        <div className="hl-partner-home__context-row">
          <div><h1>口コミを集める</h1><p>{center.context.shopName}の口コミ導線</p></div>
          <a className="hl-partner-home__text-link" href={center.context.canonicalUrl}>公開店舗ページを確認</a>
        </div>
      </header>

      <section className="hl-partner-home__action" aria-labelledby="growth-center-how-heading">
        <p className="hl-partner-home__eyebrow">How it works</p>
        <h2 id="growth-center-how-heading">正しい導線を、実際に利用したお客様へ</h2>
        <ol className="hl-partner-growth-center__funnel"><li>導線を確認</li><li>必要な場所で案内</li><li>投稿は人による審査後に公開</li></ol>
        <p>評価の指定、特典や報酬による依頼、良い口コミだけを求める案内は行いません。</p>
      </section>

      <section className="hl-partner-home__section" aria-labelledby="growth-center-assets-heading">
        <div className="hl-partner-home__section-heading"><div><p className="hl-partner-home__eyebrow">Assets</p><h2 id="growth-center-assets-heading">配布するものを選ぶ</h2></div><a className="hl-partner-home__text-link" href="/partner/">ダッシュボードへ戻る</a></div>
        <div className="hl-partner-home__collection">
          <section className="hl-partner-home__asset" aria-labelledby="growth-review-url-heading"><h3 id="growth-review-url-heading">口コミURL</h3><p>お客様へ直接ご案内するためのURLです。</p>{reviewUrl?.status === "available" ? <PartnerCopyButton label="口コミURL" value={reviewUrl.value} /> : <Unavailable asset={unavailable(reviewUrl)} />}</section>
          <section className="hl-partner-home__asset" aria-labelledby="growth-qr-heading"><h3 id="growth-qr-heading">店頭QR</h3><p>会計後など、店頭でご案内するためのQRです。</p>{qrDataUrl && qr?.status === "available" ? <><img className="hl-partner-growth-kit__qr" src={qrDataUrl} alt="口コミURLのQRコード" width={256} height={256} /><a className="hl-partner-home__text-link" href={qrDataUrl} download="eskomi-review-qr.png">QRをダウンロード</a></> : <Unavailable asset={unavailable(qr)} />}</section>
          <section className="hl-partner-home__asset" aria-labelledby="growth-line-heading"><h3 id="growth-line-heading">LINE案内文</h3><p>来店後に中立的な案内文として利用できます。</p>{line?.status === "available" ? <PartnerCopyButton label="LINE案内文" value={line.value} /> : <Unavailable asset={unavailable(line)} />}</section>
          <section className="hl-partner-home__asset" aria-labelledby="growth-cta-heading"><h3 id="growth-cta-heading">Webサイト用CTA</h3><p>店舗サイトから口コミ投稿へ案内するためのものです。設置は任意です。</p>{websiteCta?.status === "available" ? <PartnerCopyButton label="Webサイト用CTA" value={websiteCta.value} /> : <Unavailable asset={unavailable(websiteCta)} />}</section>
          <section className="hl-partner-home__asset hl-partner-growth-center__widget" aria-labelledby="growth-widget-heading"><h3 id="growth-widget-heading">口コミWidget</h3><p>店舗サイトに任意で設置できます。</p>{widget?.status === "available" && widgetSnippet ? <><a className="hl-partner-home__text-link" href={widget.value} target="_blank" rel="noreferrer">Widgetを確認</a><PartnerCopyButton label="Widgetコード" value={widgetSnippet} /><details><summary>設置方法を見る</summary><ol><li>Widgetを確認し、対象店舗を確かめます。</li><li>Widgetコードをコピーします。</li><li>店舗サイトの任意のHTML表示位置へ貼り付けます。</li></ol></details></> : <Unavailable asset={unavailable(widget)} />}</section>
        </div>
      </section>
    </div>
  </main>;
}

function Unavailable({ asset }: { asset: Readonly<{ status: "unavailable" | "misconfigured"; message: string; prerequisite: string }> | null }) {
  if (asset === null) return null;
  return <div className="hl-partner-growth-center__asset-state" role="status"><strong>{asset.status === "misconfigured" ? "設定確認が必要です" : "準備中です"}</strong><p>{asset.message}</p><p>{asset.prerequisite}</p></div>;
}
