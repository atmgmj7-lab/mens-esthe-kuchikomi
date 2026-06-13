import Link from "next/link";
import { EsSectionTitle } from "@/components/SectionTitle";
import { AreaLatestReviews } from "@/components/area/AreaLatestReviews";
import { AreaHubRankingSections, buildFaqItems } from "@/components/area/area-hub-content";
import { AreaShopList } from "@/components/common/AreaShopCard";
import { Pagination } from "@/components/Pagination";
import {
  aggregateReviewCountLabel,
  resolveAreaHubContext,
  resolveLastUpdatedLabel
} from "@/lib/area-shop-utils";
import { canonicalUrl, faqJsonLd, shopItemListJsonLd } from "@/lib/seo";
import type { AreaView, ShopView } from "@/lib/wp/types";

const FILTER_CHIPS = [
  { href: "#late-night", label: "深夜営業" },
  { href: "#station", label: "駅近" },
  { href: "#price-table", label: "料金掲載あり" },
  { href: "#official", label: "公式サイトあり" },
  { href: "#beginner", label: "初心者向け" }
] as const;

const PAGE1_ANCHOR_LINKS = [
  { href: "#shop-list", label: "店舗一覧" },
  { href: "#ranking", label: "おすすめランキング" },
  { href: "#price-table", label: "料金比較" },
  { href: "#late-night", label: "深夜営業" },
  { href: "#beginner", label: "初心者向け" },
  { href: "#station", label: "駅近" },
  { href: "#reviews", label: "口コミ・編集部レビュー" },
  { href: "#faq", label: "FAQ" }
] as const;

function areaHubBreadcrumbJsonLd(
  hubContext: ReturnType<typeof resolveAreaHubContext>,
  areaPath: string
) {
  const items: Array<{ "@type": string; position: number; name: string; item: string }> = [
    { "@type": "ListItem", position: 1, name: "TOP", item: canonicalUrl("/") }
  ];

  if (hubContext.parentSlug && hubContext.parentName) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: hubContext.parentName,
      item: canonicalUrl(`/area/${hubContext.parentSlug}/`)
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: hubContext.hubTitle,
    item: canonicalUrl(areaPath)
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
  };
}

export function AreaHubPageTemplate({
  area,
  shops,
  rankingShops,
  currentPage,
  totalPages,
  parentArea
}: {
  area: AreaView;
  shops: ShopView[];
  rankingShops: ShopView[];
  currentPage: number;
  totalPages: number;
  parentArea?: AreaView | null;
}) {
  const hubContext = resolveAreaHubContext(area, parentArea);
  const areaPath = `/area/${area.slug}/`;
  const isFirstPage = currentPage === 1;
  const faqItems = buildFaqItems(hubContext);
  const lastUpdated = resolveLastUpdatedLabel(rankingShops);

  const pageTitle =
    currentPage > 1
      ? `${hubContext.hubTitle}（${currentPage}ページ目）`
      : hubContext.hubTitle;

  return (
    <main
      id="main_content"
      className="l-main_content l-article hl-area-hub-page hl-nihonbashi-seo-page hl-nihonbashi-hub-page"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(areaHubBreadcrumbJsonLd(hubContext, areaPath))
        }}
      />
      {isFirstPage ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                shopItemListJsonLd(shops, hubContext.shopListH2, areaPath)
              )
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqItems)) }}
          />
        </>
      ) : null}

      <div className="l-main_content__inner hl-page-inner">
        <nav className="area-hub-breadcrumb" aria-label="パンくず">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true"> &gt; </span>
          {hubContext.parentSlug && hubContext.parentName ? (
            <>
              <Link href={`/area/${hubContext.parentSlug}/`}>{hubContext.parentName}</Link>
              <span aria-hidden="true"> &gt; </span>
            </>
          ) : null}
          <span>
            {area.slug === "nihonbashi" ? "大阪日本橋メンズエステ" : hubContext.hubTitle}
          </span>
        </nav>

        <header className="area-hub-header">
          <h1 className="area-hub-hero__title">{pageTitle}</h1>
          <p className="area-hub-hero__lead">{hubContext.hubDescription}</p>

          <dl className="area-hub-hero__stats">
            <div>
              <dt>掲載店舗数</dt>
              <dd>{area.count}件</dd>
            </div>
            {isFirstPage ? (
              <>
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
                  <dd>{hubContext.coverageLabel}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>ページ</dt>
                <dd>
                  {currentPage} / {totalPages}
                </dd>
              </div>
            )}
          </dl>

          <div className="area-hub-filter-chips" aria-label="条件で探す">
            <span className="area-hub-filter-chips__label">条件で探す</span>
            {FILTER_CHIPS.map((chip) => (
              <a
                key={chip.href}
                href={isFirstPage ? chip.href : `${areaPath}${chip.href}`}
                className="area-hub-filter-chips__chip"
              >
                {chip.label}
              </a>
            ))}
          </div>

          {isFirstPage ? (
            <nav className="area-hub-anchor-nav" aria-label="ページ内ナビゲーション">
              {PAGE1_ANCHOR_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="area-hub-anchor-nav__link">
                  {link.label}
                </a>
              ))}
            </nav>
          ) : null}
        </header>

        <section className="area-hub-section area-hub-section--shop-list" id="shop-list">
          <EsSectionTitle en="SHOP LIST" ja={hubContext.shopListH2} large />
          <p className="area-hub-section__intro">{hubContext.shopListIntro}</p>
          {shops.length > 0 ? (
            <>
              <AreaShopList shops={shops} targetArea={area} />
              <Pagination currentPage={currentPage} totalPages={totalPages} basePath={areaPath} />
            </>
          ) : (
            <p className="area-hub-section__empty">店舗情報を準備中です。</p>
          )}
        </section>

        {isFirstPage ? (
          <>
            <AreaLatestReviews shops={rankingShops} hubContext={hubContext} />
            <AreaHubRankingSections
              rankingShops={rankingShops}
              targetArea={area}
              hubContext={hubContext}
            />
          </>
        ) : null}

        {isFirstPage && hubContext.guidePath ? (
          <section className="area-hub-section area-hub-section--cta">
            <div className="area-hub-cta-panel">
              <h2>{hubContext.guideTitle}</h2>
              <p>
                料金相場・口コミの見方・深夜営業の注意点など、初めての方向けの解説は別ページでまとめています。
              </p>
              <Link href={hubContext.guidePath} className="area-hub-btn area-hub-btn--primary">
                {hubContext.guideCtaLabel}
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
