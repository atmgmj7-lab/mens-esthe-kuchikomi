import Link from "next/link";
import { EsSectionTitle } from "@/components/SectionTitle";
import { NihonbashiHubShopList } from "@/components/NihonbashiHubCard";
import { NihonbashiRankingSections } from "@/components/nihonbashi-content";
import { FAQ_ITEMS } from "@/components/nihonbashi-content";
import { Pagination } from "@/components/Pagination";
import {
  aggregateReviewCountLabel,
  NIHONBASHI_HUB_DESCRIPTION,
  NIHONBASHI_HUB_TITLE,
  resolveLastUpdatedLabel
} from "@/lib/nihonbashi-shop-utils";
import { canonicalUrl, faqJsonLd, shopItemListJsonLd } from "@/lib/seo";
import type { AreaView, ShopView } from "@/lib/wp/types";

const ANCHOR_LINKS = [
  { href: "#shop-list", label: "店舗一覧" },
  { href: "#ranking", label: "おすすめランキング" },
  { href: "#price-table", label: "料金比較" },
  { href: "#late-night", label: "深夜営業" },
  { href: "#beginner", label: "初心者向け" },
  { href: "#station", label: "駅近" },
  { href: "#reviews", label: "口コミ・編集部レビュー" },
  { href: "#faq", label: "FAQ" }
] as const;

function nihonbashiHubBreadcrumbJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TOP", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: "大阪", item: canonicalUrl("/area/osaka/") },
      {
        "@type": "ListItem",
        position: 3,
        name: NIHONBASHI_HUB_TITLE,
        item: canonicalUrl("/area/nihonbashi/")
      }
    ]
  };
}

export function NihonbashiAreaHubPage({
  area,
  shops,
  rankingShops,
  currentPage,
  totalPages
}: {
  area: AreaView;
  shops: ShopView[];
  rankingShops: ShopView[];
  currentPage: number;
  totalPages: number;
}) {
  const lastUpdated = resolveLastUpdatedLabel(rankingShops);

  return (
    <main id="main_content" className="l-main_content l-article hl-nihonbashi-seo-page hl-nihonbashi-hub-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(nihonbashiHubBreadcrumbJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            shopItemListJsonLd(shops, "日本橋メンズエステ店舗一覧", "/area/nihonbashi/")
          )
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ_ITEMS)) }}
      />

      <div className="l-main_content__inner hl-page-inner">
        <nav className="nb-breadcrumb" aria-label="パンくず">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true"> &gt; </span>
          <Link href="/area/osaka/">大阪</Link>
          <span aria-hidden="true"> &gt; </span>
          <span>大阪日本橋メンズエステ</span>
        </nav>

        <header className="nb-hub-header">
          <h1 className="nb-hero__title">{NIHONBASHI_HUB_TITLE}</h1>
          <p className="nb-hero__lead">{NIHONBASHI_HUB_DESCRIPTION}</p>

          <dl className="nb-hero__stats">
            <div>
              <dt>掲載店舗数</dt>
              <dd>{area.count}件</dd>
            </div>
            <div>
              <dt>口コミ件数</dt>
              <dd>{aggregateReviewCountLabel(rankingShops)}</dd>
            </div>
            <div>
              <dt>最終更新日</dt>
              <dd>{lastUpdated}</dd>
            </div>
            <div>
              <dt>対応エリア</dt>
              <dd>日本橋・近鉄日本橋・なんば・谷町九丁目・黒門市場周辺</dd>
            </div>
          </dl>

          <nav className="nb-anchor-nav" aria-label="ページ内ナビゲーション">
            {ANCHOR_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="nb-anchor-nav__link">
                {link.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="nb-section nb-section--shop-list" id="shop-list">
          <EsSectionTitle en="SHOP LIST" ja="日本橋メンズエステ店舗一覧" large />
          <p className="nb-section__intro">
            大阪日本橋・近鉄日本橋・なんば周辺のメンズエステを、口コミ・料金目安・営業時間・アクセス・編集部コメントで比較できます。
            日本橋ど真ん中の店舗を優先表示し、近隣エリアの関連店舗もあわせて掲載しています。
          </p>
          {shops.length > 0 ? (
            <>
              <NihonbashiHubShopList shops={shops} />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath="/area/nihonbashi/"
              />
            </>
          ) : (
            <p className="nb-section__empty">店舗情報を準備中です。</p>
          )}
        </section>

        <NihonbashiRankingSections rankingShops={rankingShops} />

        <section className="nb-section nb-section--cta">
          <div className="nb-cta-panel">
            <h2>日本橋で失敗しない選び方を詳しく読む</h2>
            <p>料金相場・口コミの見方・深夜営業の注意点など、初めての方向けの解説は別ページでまとめています。</p>
            <Link href="/osaka-nihonbashi/" className="nb-btn nb-btn--primary">
              選び方ガイドを見る
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
