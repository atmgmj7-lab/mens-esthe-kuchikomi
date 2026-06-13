import Link from "next/link";
import { EsSectionTitle } from "@/components/SectionTitle";
import { RankingCard } from "@/components/nihonbashi-content";
import {
  extractShopPriceYen,
  NIHONBASHI_GUIDE_DESCRIPTION,
  NIHONBASHI_GUIDE_TITLE,
  resolveLastUpdatedLabel,
  sortNihonbashiShopsForRanking
} from "@/lib/nihonbashi-shop-utils";
import { canonicalUrl } from "@/lib/seo";
import type { AreaView, ShopView } from "@/lib/wp/types";

function nihonbashiGuideBreadcrumbJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TOP", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: "大阪", item: canonicalUrl("/area/osaka/") },
      {
        "@type": "ListItem",
        position: 3,
        name: NIHONBASHI_GUIDE_TITLE,
        item: canonicalUrl("/osaka-nihonbashi/")
      }
    ]
  };
}

export function NihonbashiGuidePage({
  area,
  shops
}: {
  area: AreaView;
  shops: ShopView[];
}) {
  const topShops = sortNihonbashiShopsForRanking(shops).slice(0, 5);
  const prices = shops.map(extractShopPriceYen).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const lastUpdated = resolveLastUpdatedLabel(shops);

  return (
    <main id="main_content" className="l-main_content l-article hl-nihonbashi-seo-page hl-nihonbashi-guide-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(nihonbashiGuideBreadcrumbJsonLd()) }}
      />

      <div className="nb-hero">
        <div className="l-main_content__inner hl-page-inner">
          <nav className="nb-breadcrumb" aria-label="パンくず">
            <Link href="/">ホーム</Link>
            <span aria-hidden="true"> &gt; </span>
            <Link href="/area/osaka/">大阪</Link>
            <span aria-hidden="true"> &gt; </span>
            <span>日本橋メンズエステ選び方ガイド</span>
          </nav>

          <h1 className="nb-hero__title">{NIHONBASHI_GUIDE_TITLE}</h1>
          <p className="nb-hero__lead">{NIHONBASHI_GUIDE_DESCRIPTION}</p>

          <div className="nb-hero__cta">
            <Link href="/area/nihonbashi/" className="nb-btn nb-btn--primary">
              大阪日本橋メンズエステの店舗一覧・ランキングを見る
            </Link>
          </div>
        </div>
      </div>

      <div className="l-main_content__inner hl-page-inner">
        <section className="nb-section">
          <EsSectionTitle en="AREA" ja="日本橋エリアの特徴" large />
          <p className="nb-section__intro">
            大阪・日本橋（なんば・近鉄日本橋を含む）は、メンズエステ店舗が集中する関西有数のエリアです。
            日本橋駅・近鉄日本橋駅・なんば駅・谷町九丁目駅からアクセスしやすく、仕事帰りや買い物ついでに立ち寄りやすい立地の店舗が多くあります。
            黒門市場周辺から谷町九丁目方面まで、エリアの広がりに応じて店舗の雰囲気や料金帯も異なるため、まずは店舗一覧で条件を比較するのがおすすめです。
          </p>
        </section>

        <section className="nb-section" id="price-guide">
          <EsSectionTitle en="MARKET" ja="日本橋メンズエステの料金相場" large />
          {minPrice && maxPrice ? (
            <p className="nb-section__intro">
              掲載店舗の料金目安はおおむね
              <strong>
                {minPrice.toLocaleString("ja-JP")}円〜{maxPrice.toLocaleString("ja-JP")}円
              </strong>
              の範囲です（{lastUpdated}時点の公開情報）。コース・オプション・時間帯により変動するため、予約前に各店舗ページまたは公式サイトで最新料金を必ず確認してください。
            </p>
          ) : (
            <p className="nb-section__intro">
              料金は店舗・コースごとに異なります。比較の際は「60分目安」を参考値として扱い、最終的な金額は公式情報で確認してください。
            </p>
          )}
        </section>

        <section className="nb-section" id="beginner-pitfalls">
          <EsSectionTitle en="BEGINNER" ja="初心者が失敗しやすいポイント" large />
          <div className="nb-guide-cards">
            <article className="nb-guide-card">
              <h3>営業時間と最終受付の見落とし</h3>
              <p>
                「24時まで営業」と「最終受付22時」では利用できる時間が異なります。仕事帰りの利用を想定する場合は、最終受付時刻まで店舗ページで確認してください。
              </p>
            </article>
            <article className="nb-guide-card">
              <h3>料金表記の誤解</h3>
              <p>
                掲載の「60分○○円」は基本コースの目安です。指名料・オプション・延長料金が別途かかる場合があるため、問い合わせ時に総額を確認しましょう。
              </p>
            </article>
            <article className="nb-guide-card">
              <h3>予約方法の確認不足</h3>
              <p>
                完全予約制・電話のみ・LINE予約など店舗ごとに異なります。公式サイトや店舗ページの予約導線を先に確認するとスムーズです。
              </p>
            </article>
          </div>
        </section>

        <section className="nb-section" id="review-tips">
          <EsSectionTitle en="REVIEWS" ja="口コミを見るときの注意点" large />
          <p className="nb-section__intro">
            当サイトではユーザー投稿口コミ、編集部コメント、実地確認レビューを分けて掲載しています。
            口コミは個人の体験に基づく主観的な情報であり、セラピストの出勤状況や料金は変更されることがあります。
            編集部コメントは公開情報の整理であり、口コミ評価の代替ではありません。複数の情報源を組み合わせて判断してください。
          </p>
        </section>

        <section className="nb-section" id="late-night-tips">
          <EsSectionTitle en="LATE NIGHT" ja="深夜営業を選ぶときの注意点" large />
          <p className="nb-section__intro">
            深夜営業の表記は「翌○時」「24時間」など店舗ごとに異なります。最終受付が早い場合もあるため、出発前に電話または公式サイトで空き状況を確認することをおすすめします。
            深夜帯の料金が割増になる店舗もあるため、料金表もあわせて確認してください。
          </p>
        </section>

        <section className="nb-section" id="area-diff">
          <EsSectionTitle en="AREAS" ja="日本橋・なんば・谷町九丁目の違い" large />
          <div className="nb-guide-cards">
            <article className="nb-guide-card">
              <h3>日本橋・近鉄日本橋</h3>
              <p>
                メンズエステ店舗が最も集中する中心エリア。駅から近く、比較検討しやすい店舗数が多いのが特徴です。
              </p>
            </article>
            <article className="nb-guide-card">
              <h3>なんば</h3>
              <p>
                難波駅周辺は買い物・飲食と合わせて利用しやすい立地。日本橋エリアと徒歩圏で重なる店舗もあります。
              </p>
            </article>
            <article className="nb-guide-card">
              <h3>谷町九丁目</h3>
              <p>
                日本橋から少し南側のエリア。落ち着いた雰囲気の店舗が多い傾向があり、日本橋中心部とあわせて比較すると選びやすくなります。
              </p>
            </article>
          </div>
        </section>

        <section className="nb-section" id="top-picks">
          <EsSectionTitle en="PICKS" ja="参考：比較しやすい店舗（上位5件）" large />
          <p className="nb-section__intro">
            公開情報の充実度などをもとに選んだ参考店舗です。満足度や口コミ評価のランキングではありません。
            全{area.count}件の一覧・ランキング・料金比較は店舗一覧ページをご覧ください。
          </p>
          <div className="nb-ranking-list">
            {topShops.map((shop, index) => (
              <RankingCard key={shop.id} shop={shop} rank={index + 1} />
            ))}
          </div>
        </section>

        <section className="nb-section nb-section--cta">
          <div className="nb-cta-panel">
            <h2>日本橋メンズエステの店舗一覧・ランキングを見る</h2>
            <p>
              口コミ・料金・営業時間・駅近・深夜営業で{area.count}件の店舗を比較できます。
            </p>
            <Link href="/area/nihonbashi/" className="nb-btn nb-btn--primary">
              大阪日本橋メンズエステおすすめ一覧へ
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
