import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Mrs.Rank UP 導入ガイド",
  description: "Eskomi Free Official Partnerの掲載情報・口コミ導線・審査公開の流れをご案内します。",
  path: "/partner/guide/",
});

export default function PartnerGuidePage() {
  return (
    <main id="main_content" className="l-mainContent hl-partner-guide">
      <div className="l-mainContent__inner hl-page-inner hl-partner-guide__inner">
        <header className="hl-partner-guide__hero">
          <p className="hl-static-page-kicker">ESKOMI FREE OFFICIAL PARTNER</p>
          <h1>Mrs.Rank UP 導入ガイド</h1>
          <p>掲載情報の確認と、率直な口コミを受け付けるための導線を、店舗・お客様・運営の役割に分けてご案内します。</p>
          <p>口コミの評価指定、特典・報酬による依頼、良い口コミだけを求める案内は行いません。</p>
        </header>

        <section className="hl-partner-guide__section" aria-labelledby="partner-guide-roles-heading">
          <p className="hl-static-page-kicker">WHO DOES WHAT</p>
          <h2 id="partner-guide-roles-heading">役割と実際の操作</h2>
          <div className="hl-partner-guide__roles">
            <article>
              <p className="hl-partner-guide__role">店舗担当者</p>
              <h3>掲載情報を確認し、必要な変更を申請</h3>
              <p>公開中の店舗詳細から対象を確定して申請します。申請内容は自動公開されません。招待済みならログイン後に口コミQR・URLも確認できます。</p>
              <div><Link href="/shops/">掲載中の店舗を探す</Link><Link href="/partner/login/">パートナーログイン</Link></div>
            </article>
            <article>
              <p className="hl-partner-guide__role">お客様</p>
              <h3>実際に利用した感想を任意で回答</h3>
              <p>店頭QRまたは案内URLから投稿できます。投稿内容は審査前に公開されず、店舗側が公開可否を決めるものではありません。</p>
              <Link href="/reviews/">口コミの方針を見る</Link>
            </article>
            <article>
              <p className="hl-partner-guide__role">Eskomi運営</p>
              <h3>審査と公開を分けて判断</h3>
              <p>投稿本文や評価は書き換えず、審査後に公開の判断を行います。公開済み・却下済みの履歴は要対応キューに混在させません。</p>
              <a href="/dashboard/partners/">運営用の審査画面へ</a>
            </article>
          </div>
        </section>

        <section className="hl-partner-guide__section" aria-labelledby="partner-guide-flow-heading">
          <p className="hl-static-page-kicker">REVIEW FLOW</p>
          <h2 id="partner-guide-flow-heading">口コミの流れ</h2>
          <ol className="hl-partner-guide__flow">
            <li><strong>1. 店舗担当者</strong><span>招待済みログインから、既存の口コミURL・店頭QRを取得します。</span></li>
            <li><strong>2. お客様</strong><span>実際に利用した感想を任意で投稿します。評価や内容の指定はありません。</span></li>
            <li><strong>3. 運営</strong><span>投稿を審査し、承認後も公開を別操作で判断します。</span></li>
            <li><strong>4. 公開</strong><span>公開済みの口コミだけを店舗ページに表示します。</span></li>
          </ol>
        </section>

        <section className="hl-partner-guide__section hl-partner-guide__next" aria-labelledby="partner-guide-next-heading">
          <p className="hl-static-page-kicker">NEXT STEP</p>
          <h2 id="partner-guide-next-heading">まずは状況に合う入口へ</h2>
          <div><Link href="/storelisting/">掲載・情報修正について</Link><Link href="/partner/login/">招待済み担当者のログイン</Link></div>
        </section>
      </div>
    </main>
  );
}
