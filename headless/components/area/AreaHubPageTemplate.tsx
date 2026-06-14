import Link from "next/link";
import { AreaLatestReviews } from "@/components/area/AreaLatestReviews";
import { AreaTitleBanner } from "@/components/area/hub/AreaTitleBanner";
import { ThemeBanner } from "@/components/area/hub/ThemeBanner";
import { AreaHubSectionHeader } from "@/components/area/hub/AreaHubSectionHeader";
import { AreaHubSectionShell } from "@/components/area/hub/AreaHubSectionShell";
import {
  AreaHubCompareTabsSections,
  AreaHubPriceAndGuideSections,
  AreaHubRankingTop,
  AreaFaqSection,
  buildFaqItems
} from "@/components/area/area-hub-content";
import { AreaHubRelatedAreas } from "@/components/area/hub/AreaHubRelatedAreas";
import { AreaShopList } from "@/components/area/hub/AreaShopList";
import { resolveAreaHeroBanner } from "@/lib/area-hub-banner-config";
import { resolveAreaTitleBanner } from "@/lib/area-title-banner-config";
import {
  aggregateReviewCountLabel,
  resolveAreaHubContext,
  resolveLastUpdatedLabel
} from "@/lib/area-shop-utils";
import { canonicalUrl, faqJsonLd, shopItemListJsonLd } from "@/lib/seo";
import type { AreaView, ShopView } from "@/lib/wp/types";

const SECTION_NAV_CHIPS = [
  { href: "#price-table", label: "料金比較" },
  { href: "#late-night", label: "深夜営業" },
  { href: "#beginner", label: "初心者向け" },
  { href: "#station", label: "駅近" },
  { href: "?filter=official#shop-list", label: "公式サイトあり" }
] as const;

const PAGE_ANCHOR_LINKS = [
  { href: "#ranking", label: "おすすめランキング" },
  { href: "#shop-list", label: "店舗一覧" },
  { href: "#compare-tabs", label: "条件別比較" },
  { href: "#reviews", label: "口コミ" },
  { href: "#price-guide", label: "料金相場" },
  { href: "#faq", label: "FAQ" },
  { href: "#related-areas", label: "関連エリア" }
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
    name: hubContext.breadcrumbLabel,
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
  allShops,
  legacyPage = 1,
  parentArea,
  siblingAreas = [],
  childAreas = []
}: {
  area: AreaView;
  allShops: ShopView[];
  legacyPage?: number;
  parentArea?: AreaView | null;
  siblingAreas?: AreaView[];
  childAreas?: AreaView[];
}) {
  const hubContext = resolveAreaHubContext(area, parentArea);
  const areaPath = `/area/${area.slug}/`;
  const faqItems = buildFaqItems(hubContext);
  const lastUpdated = resolveLastUpdatedLabel(allShops);
  const areaHeroBanner = resolveAreaHeroBanner(area.slug);
  const areaTitleBanner = resolveAreaTitleBanner(area.slug);

  return (
    <main
      id="main_content"
      className="l-main_content l-article hl-area-hub-page"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(areaHubBreadcrumbJsonLd(hubContext, areaPath))
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(shopItemListJsonLd(allShops, hubContext.shopListH2, areaPath))
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqItems)) }}
      />

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
          <span>{hubContext.breadcrumbLabel}</span>
        </nav>

        {areaTitleBanner ? (
          <AreaTitleBanner areaSlug={area.slug} config={areaTitleBanner} />
        ) : (
          <ThemeBanner
            themeKey="areaHero"
            message={areaHeroBanner.message}
            imageSrc={areaHeroBanner.imageSrc}
            imageAlt={areaHeroBanner.imageAlt}
          />
        )}

        <header className="area-hub-header">
          <h1 className="area-hub-hero__title">{hubContext.hubTitle}</h1>
          <p className="area-hub-hero__lead">{hubContext.hubDescription}</p>

          <dl className="area-hub-hero__stats">
            <div>
              <dt>掲載店舗数</dt>
              <dd>{area.count}件</dd>
            </div>
            <div>
              <dt>口コミ件数</dt>
              <dd>{aggregateReviewCountLabel(allShops)}</dd>
            </div>
            <div>
              <dt>最終更新日</dt>
              <dd>{lastUpdated}</dd>
            </div>
            <div>
              <dt>対応エリア</dt>
              <dd>{hubContext.coverageLabel}</dd>
            </div>
          </dl>

          <div className="area-hub-filter-chips" aria-label="セクションへ移動">
            <span className="area-hub-filter-chips__label">条件で探す</span>
            {SECTION_NAV_CHIPS.map((chip) => (
              <a key={chip.href} href={chip.href} className="area-hub-filter-chips__chip">
                {chip.label}
              </a>
            ))}
          </div>

          <nav className="area-hub-anchor-nav" aria-label="ページ内ナビゲーション">
            {PAGE_ANCHOR_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="area-hub-anchor-nav__link">
                {link.label}
              </a>
            ))}
          </nav>
        </header>

        <AreaHubRankingTop rankingShops={allShops} targetArea={area} hubContext={hubContext} />

        <AreaHubSectionShell theme="shop-list" areaSlug={area.slug} id="shop-list">
          <AreaHubSectionHeader theme="shop-list" areaSlug={area.slug} ja={hubContext.shopListH2} />
          <p className="area-hub-section__intro">{hubContext.shopListIntro}</p>
          {allShops.length > 0 ? (
            <AreaShopList shops={allShops} targetArea={area} legacyPage={legacyPage} />
          ) : (
            <p className="area-hub-section__empty">店舗情報を準備中です。</p>
          )}
        </AreaHubSectionShell>

        <AreaHubCompareTabsSections
          rankingShops={allShops}
          targetArea={area}
          hubContext={hubContext}
        />
        <AreaLatestReviews shops={allShops} hubContext={hubContext} />
        <AreaHubPriceAndGuideSections rankingShops={allShops} hubContext={hubContext} />
        <AreaFaqSection items={faqItems} areaSlug={area.slug} />
        <AreaHubRelatedAreas
          area={area}
          parentArea={parentArea}
          siblingAreas={siblingAreas}
          childAreas={childAreas}
        />

        {hubContext.guidePath ? (
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
