import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";

import { PartnerPopActions } from "@/components/partner/PartnerPopActions";
import { resolvePartnerReviewGrowthCenter } from "@/lib/partner/partner-review-growth-kit";
import { PARTNER_SESSION_COOKIE, authorizePartnerReviewGrowthSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const instant = false;

export const metadata: Metadata = pageMetadata({
  title: "口コミPOP | パートナー",
  description: "Eskomi Partner向けの印刷用口コミPOP",
  path: "/partner/growth/pop/",
  robots: { index: false, follow: false },
});

export default async function PartnerReviewPopPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const dashboard = await authorizePartnerReviewGrowthSession({ accessToken });
  if (dashboard.status !== "allowed") redirect("/partner/login/");

  const center = resolvePartnerReviewGrowthCenter(dashboard.identity, dashboard.metrics);
  if (center.status !== "allowed") redirect("/partner/login/");
  const qr = center.assets.find((asset) => asset.key === "qr");
  const qrDataUrl = qr?.status === "available"
    ? await QRCode.toDataURL(qr.value, { errorCorrectionLevel: "M", margin: 1, width: 720 })
    : null;

  return (
    <main id="main_content" className="l-mainContent hl-partner-pop-page">
      <div className="l-mainContent__inner hl-page-inner hl-partner-pop-page__inner">
        {!qrDataUrl ? (
          <section className="hl-partner-home__section" aria-labelledby="partner-pop-unavailable-heading">
            <p className="hl-partner-home__eyebrow">Review POP</p>
            <h1 id="partner-pop-unavailable-heading">印刷用POPはまだ作成できません</h1>
            <p>この店舗に紐づく有効な店頭QRが確認できるまで、実QR入りのPOPは表示・ダウンロードしません。</p>
            <p><a className="hl-partner-home__text-link" href="/partner/growth/">口コミ導線へ戻る</a></p>
          </section>
        ) : (
          <>
            <p className="hl-partner-pop-page__notice">現在有効な店頭QR用のURLから生成しています。印刷後は読み取り先と店舗名を確認してください。</p>
            <article className="hl-partner-pop" aria-labelledby="partner-pop-heading">
              <img className="hl-partner-pop__logo" src="/images/eskomi-logo.svg" alt="Eskomi（エスコミ）" width={202} height={68} />
              <p className="hl-partner-pop__eyebrow">ご利用後の口コミ</p>
              <h1 id="partner-pop-heading">ご利用後のご感想をお聞かせください</h1>
              <p className="hl-partner-pop__shop">{center.context.shopName}</p>
              <p className="hl-partner-pop__lead">実際にご利用いただいたご感想を、よろしければお聞かせください。回答は任意です。</p>
              <img className="hl-partner-pop__qr" src={qrDataUrl} width={360} height={360} alt={`${center.context.shopName}の口コミ投稿用QRコード`} />
              <p className="hl-partner-pop__instruction">スマートフォンのカメラで読み取ると、口コミ投稿ページが開きます。</p>
              <p className="hl-partner-pop__note">投稿内容は運営が確認し、審査と公開を分けて判断します。評価や内容を指定する依頼、特典・報酬による依頼は行いません。</p>
              <p className="hl-partner-pop__brand">Eskomi（エスコミ）</p>
            </article>
            <PartnerPopActions />
          </>
        )}
      </div>
    </main>
  );
}
