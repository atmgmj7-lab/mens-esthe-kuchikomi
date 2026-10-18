import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";

import { PartnerCopyButton } from "@/components/partner/PartnerCopyButton";
import { EskomiBannerV2Slot } from "@/components/EskomiBannerV2Slot";
import { buildPartnerWidgetIframeSnippet } from "@/lib/partner/partner-review-widget";
import { resolvePartnerReviewGrowthCenter } from "@/lib/partner/partner-review-growth-kit";
import { PARTNER_SESSION_COOKIE, authorizePartnerReviewGrowthSession } from "@/lib/partner/partner-session";
import { partnerLoginUrl } from "@/lib/partner/partner-login-return-to";
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
  if (dashboard.status !== "allowed") redirect(partnerLoginUrl("/partner/growth/"));
  const center = resolvePartnerReviewGrowthCenter(dashboard.identity, dashboard.metrics);
  if (center.status !== "allowed") redirect(partnerLoginUrl("/partner/growth/"));
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
  const lineShareUrl = line?.status === "available" ? `https://line.me/R/msg/text/?${encodeURIComponent(line.value)}` : null;
  const mailShareUrl = line?.status === "available" ? `mailto:?subject=${encodeURIComponent(`${center.context.shopName}へのご感想のお願い`)}&body=${encodeURIComponent(line.value)}` : null;

  return <main id="main_content" className="l-mainContent l-article hl-partner-home hl-partner-growth-center" data-partner-growth-center-root>
    <div className="l-mainContent__inner hl-page-inner hl-partner-home__inner">
      <header className="hl-partner-home__context">
        <p className="hl-partner-home__eyebrow">口コミのご案内</p>
        <div className="hl-partner-home__context-row">
          <div><h1>口コミを集める</h1><p>{center.context.shopName}の口コミ導線</p></div>
          <a className="hl-partner-home__text-link" href={center.context.canonicalUrl}>公開店舗ページを確認</a>
        </div>
      </header>

      <section className="hl-partner-home__action" aria-labelledby="growth-center-how-heading">
        <p className="hl-partner-home__eyebrow">ご利用の流れ</p>
        <h2 id="growth-center-how-heading">正しい導線を、実際に利用したお客様へ</h2>
        <ol className="hl-partner-growth-center__funnel"><li>投稿ページを確認する</li><li>お客様へリンクやQRをご案内する</li><li>口コミは審査後に公開される</li></ol>
        <p>評価の指定、特典や報酬による依頼、良い口コミだけを求める案内は行いません。</p>
      </section>

      <EskomiBannerV2Slot id="B02" />

      <section className="hl-partner-home__section" aria-labelledby="growth-center-assets-heading">
        <div className="hl-partner-home__section-heading"><div><p className="hl-partner-home__eyebrow">ご案内に使うもの</p><h2 id="growth-center-assets-heading">配布するものを選ぶ</h2></div><a className="hl-partner-home__text-link" href="/partner/">店舗用メニューへ戻る</a></div>
        <div className="hl-partner-home__collection">
          <section className="hl-partner-home__asset" aria-labelledby="growth-review-url-heading"><h3 id="growth-review-url-heading">お客様に送る口コミ投稿リンク</h3><p>このリンクから、お客様がこの店舗の口コミを投稿できます。</p>{reviewUrl?.status === "available" ? <><p className="hl-partner-growth-center__review-url">{reviewUrl.value}</p><div className="hl-partner-growth-center__asset-actions"><PartnerCopyButton label="リンク" value={reviewUrl.value} /><a className="hl-partner-home__text-link" href={reviewUrl.value} target="_blank" rel="noreferrer">投稿ページを確認</a></div></> : <Unavailable asset={unavailable(reviewUrl)} />}</section>
          <section className="hl-partner-home__asset" aria-labelledby="growth-qr-heading"><h3 id="growth-qr-heading">店頭用QR</h3><p>店頭でご案内するためのQRです。リンク先は上の投稿リンクと同じ店舗専用ページです。</p>{qrDataUrl && qr?.status === "available" ? <><img className="hl-partner-growth-kit__qr" src={qrDataUrl} alt="口コミ投稿リンクのQRコード" width={256} height={256} /><div className="hl-partner-growth-center__asset-actions"><a className="hl-partner-home__text-link" href={qrDataUrl} download="eskomi-review-qr.png">QRをダウンロード</a><a className="hl-partner-home__text-link" href="/partner/growth/pop/">印刷用POPを開く</a></div></> : <Unavailable asset={unavailable(qr)} />}</section>
          <section className="hl-partner-home__asset hl-partner-growth-center__message-card" aria-labelledby="growth-line-heading"><p className="hl-partner-growth-center__card-kicker">AFTER VISIT</p><h3 id="growth-line-heading">LINE・メールでご案内</h3><p>来店後のお客様へ、中立的なご案内を送れます。送信は必ずご自身で確認してから行われます。</p>{line?.status === "available" ? <><blockquote className="hl-partner-growth-center__message-preview">{line.value}</blockquote><div className="hl-partner-growth-center__asset-actions"><PartnerCopyButton label="案内文" value={line.value} /><a className="hl-partner-home__text-link" href={lineShareUrl ?? undefined} target="_blank" rel="noreferrer">LINEで開く</a><a className="hl-partner-home__text-link" href={mailShareUrl ?? undefined}>メールを作成</a></div></> : <Unavailable asset={unavailable(line)} />}</section>
          <section className="hl-partner-home__asset" aria-labelledby="growth-cta-heading"><h3 id="growth-cta-heading">店舗サイト用の案内</h3><p>店舗サイトから口コミ投稿へ案内するためのものです。設置は任意です。</p>{websiteCta?.status === "available" ? <PartnerCopyButton label="店舗サイト用の案内" value={websiteCta.value} /> : <Unavailable asset={unavailable(websiteCta)} />}</section>
          <section className="hl-partner-home__asset hl-partner-growth-center__widget" aria-labelledby="growth-widget-heading"><h3 id="growth-widget-heading">店舗サイトの口コミ表示</h3><p>運営が公開したこの店舗の口コミだけを、店舗サイトに任意で表示できます。</p>{widget?.status === "available" && widgetSnippet ? <><div className="hl-partner-growth-center__asset-actions"><a className="hl-partner-home__text-link" href={widget.value} target="_blank" rel="noreferrer">表示内容を確認</a><PartnerCopyButton label="設置用コード" value={widgetSnippet} /></div><details><summary>設置方法を見る</summary><ol><li>表示内容を確認し、対象店舗を確かめます。</li><li>設置用コードをコピーし、iframeと直後のscriptを一緒に貼り付けます。</li><li>店舗サイトの任意のHTML表示位置へ貼り付けます。</li><li>scriptを貼れないCMSでは、iframeだけを貼ってください。高さは700pxのままになり、内容が多い場合は枠内をスクロールして確認できます。</li></ol></details></> : <Unavailable asset={unavailable(widget)} />}</section>
        </div>
      </section>
      <EskomiBannerV2Slot id="B04" />
    </div>
  </main>;
}

function Unavailable({ asset }: { asset: Readonly<{ status: "unavailable" | "misconfigured"; message: string; prerequisite: string }> | null }) {
  if (asset === null) return null;
  return <div className="hl-partner-growth-center__asset-state" role="status"><strong>{asset.status === "misconfigured" ? "設定確認が必要です" : "準備中です"}</strong><p>{asset.message}</p><p>{asset.prerequisite}</p></div>;
}
