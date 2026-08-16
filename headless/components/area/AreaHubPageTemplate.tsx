import { AreaPromotionSection } from "@/components/area/hub/AreaPromotionSection";
import Link from "next/link";
import { AreaLatestReviews } from "@/components/area/AreaLatestReviews";
import { AreaHubSectionHeader } from "@/components/area/hub/AreaHubSectionHeader";
import { AreaHubSectionShell } from "@/components/area/hub/AreaHubSectionShell";
import {
  AreaHubCompareTabsSections,
  AreaHubLocalGuideSection,
  AreaHubPriceAndGuideSections,
  AreaHubRankingTop,
  AreaFaqSection,
  buildFaqItems
} from "@/components/area/area-hub-content";
import { AreaHubRelatedAreas } from "@/components/area/hub/AreaHubRelatedAreas";
import { AreaHubDecisionGuide } from "@/components/area/hub/AreaHubDecisionGuide";
import { AreaShopList } from "@/components/area/hub/AreaShopList";
import {
  aggregateReviewCountLabel,
  resolveAreaHubContext,
  resolveLastUpdatedLabel
} from "@/lib/area-shop-utils";
import { type AreaShopRankingEntry } from "@/lib/area-shop-ranking";
import {
  classifyPriorityAreaShops,
  isPriorityAreaPrecisionTarget,
  resolvePriorityAreaCapabilities,
} from "@/lib/priority-area-precision";
import { resolveAreaFeatureVisual, type AreaFeatureItem } from "@/lib/design-constants";
import { canonicalUrl, faqJsonLd, shopItemListJsonLd } from "@/lib/seo";
import type { CSSProperties } from "react";
import type { AreaView, ShopView } from "@/lib/wp/types";

function SecondaryShopLinks({ shops }: { shops: readonly ShopView[] }) {
  return (
    <ul className="area-hub-secondary-shop-list">
      {shops.map((shop) => (
        <li
          key={shop.id}
          className="area-hub-secondary-shop-list__item"
          data-area-secondary-shop="true"
          data-shop-id={shop.id}
        >
          <Link
            className="area-hub-secondary-shop-list__link"
            href={`/shops/${shop.slug}/`}
            aria-label={shop.title}
          >
            <span className="area-hub-secondary-shop-list__name">{shop.title}</span>
            {shop.primaryArea?.name ? (
              <span className="area-hub-secondary-shop-list__meta">
                主な掲載エリア：{shop.primaryArea.name}
              </span>
            ) : (
              <span className="area-hub-secondary-shop-list__meta">主な掲載エリアを確認中</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
  childAreas = [],
  rankingEntries = [],
  areaFeatures = []
}: {
  area: AreaView;
  allShops: ShopView[];
  legacyPage?: number;
  parentArea?: AreaView | null;
  siblingAreas?: AreaView[];
  childAreas?: AreaView[];
  rankingEntries?: AreaShopRankingEntry[];
  areaFeatures?: readonly AreaFeatureItem[];
}) {
  const hubContext = resolveAreaHubContext(area, parentArea);
  const areaPath = `/area/${area.slug}/`;
  const precisionMode = isPriorityAreaPrecisionTarget(area);
  const precisionGroups = precisionMode
    ? classifyPriorityAreaShops(allShops, area)
    : null;
  const mainShops: ShopView[] = precisionGroups ? [...precisionGroups.exact] : allShops;
  const capabilities = resolvePriorityAreaCapabilities(mainShops, area);
  const faqItems = buildFaqItems(hubContext, {
    includeBeginner: !precisionMode || capabilities.beginner,
  });
  const faqSchema = faqJsonLd(faqItems);
  const lastUpdated = resolveLastUpdatedLabel(mainShops);
  const shopCountLabel = precisionMode
    ? `${mainShops.length}件`
    : area.count > 0 ? `${area.count}件` : "掲載準備中";
  const reviewCountLabel = aggregateReviewCountLabel(mainShops);
  const heroVisual = resolveAreaFeatureVisual(area.slug, parentArea?.slug, areaFeatures);
  const heroStyle = heroVisual.image
    ? ({ ["--es-area-hero-image" as string]: `url("${heroVisual.image}")` } as CSSProperties)
    : undefined;

  return (
    <main
      id="main_content"
      className="l-main_content l-article hl-area-hub-page escomi-final-area-page"
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
          __html: JSON.stringify(shopItemListJsonLd(mainShops.filter((shop) => !shop.ranking.isPr), hubContext.shopListH2, areaPath))
        }}
      />
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}

      <div className="l-main_content__inner hl-page-inner escomi-final-area-shell escomi-final-area-breadcrumb-shell">
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
      </div>

      <section
        className="escomi-final-area-hero escomi-final-area-hero--photo hl-fade-in"
        aria-labelledby="area-final-title"
        aria-label={heroVisual.imageAlt}
        style={heroStyle}
      >
        <div className="escomi-final-area-hero__inner escomi-final-area-shell">
          <header className="area-hub-header escomi-final-area-hero__body">
            <p className="escomi-final-area-hero__eyebrow">AREA GUIDE</p>
            <h1 id="area-final-title" className="area-hub-hero__title">{hubContext.hubTitle}</h1>
            <p className="area-hub-hero__lead">{hubContext.hubDescription}</p>

            <dl className="area-hub-hero__stats escomi-final-area-hero__stats">
              <div>
                <dt>掲載店舗数</dt>
                <dd>{shopCountLabel}</dd>
              </div>
              <div>
                <dt>確認済み口コミ</dt>
                <dd>{reviewCountLabel}</dd>
              </div>
              {lastUpdated ? (
                <div>
                  <dt>掲載情報の確認日</dt>
                  <dd>{lastUpdated}</dd>
                </div>
              ) : null}
              <div>
                <dt>対応エリア</dt>
                <dd>{hubContext.coverageLabel}</dd>
              </div>
            </dl>

            <p className="escomi-final-area-hero__source-note">
              口コミ・編集部コメント・PR情報は分けて掲載しています。料金や営業時間は予約前に公式情報で確認してください。
            </p>
          </header>
        </div>
      </section>

      <div className="l-main_content__inner hl-page-inner escomi-final-area-shell escomi-final-area-content-shell">
        <AreaHubDecisionGuide
          hubContext={hubContext}
          shops={mainShops}
          precisionMode={precisionMode}
          capabilities={capabilities}
        />
        <AreaHubLocalGuideSection
          hubContext={hubContext}
          precisionMode={precisionMode}
          capabilities={capabilities}
        />
        <AreaHubRankingTop
          rankingShops={mainShops}
          targetArea={area}
          hubContext={hubContext}
          rankingEntries={rankingEntries}
          precisionMode={precisionMode}
        />
        <AreaPromotionSection shops={mainShops} targetArea={area} />

        <AreaHubSectionShell theme="shop-list" areaSlug={area.slug} id="shop-list">
          <AreaHubSectionHeader theme="shop-list" areaSlug={area.slug} ja={hubContext.shopListH2} />
          <p className="area-hub-section__intro">{hubContext.shopListIntro}</p>
          <div
            data-area-precision-mode={precisionMode ? "true" : undefined}
            data-area-precision-group={precisionMode ? "exact" : undefined}
          >
            {mainShops.length > 0 ? (
              <AreaShopList
                shops={mainShops}
                targetArea={area}
                legacyPage={legacyPage}
                rankingEntries={rankingEntries}
                precisionMode={precisionMode}
                capabilities={capabilities}
              />
            ) : (
              <p className="area-hub-section__empty">
                {precisionMode
                  ? "主な掲載エリアを確認できた店舗はまだありません。確認中の掲載店舗は下に分けて表示します。"
                  : "店舗情報を準備中です。"}
              </p>
            )}
          </div>
          {precisionGroups && (precisionGroups.related.length > 0 || precisionGroups.unclassified.length > 0) ? (
            <div className="area-hub-shop-list area-hub-shop-list--secondary" data-area-precision-secondary="true">
              {precisionGroups.related.length > 0 ? (
                <section className="area-hub-shop-group" data-area-precision-group="related">
                  <h3 className="area-hub-shop-group__title">別エリアを主な掲載先としている関連店舗</h3>
                  <p className="area-hub-section__intro area-hub-section__intro--compact">
                    このエリアにも掲載関係がありますが、主な掲載先は別エリアとして登録されています。
                  </p>
                  <SecondaryShopLinks shops={precisionGroups.related} />
                </section>
              ) : null}
              {precisionGroups.unclassified.length > 0 ? (
                <section className="area-hub-shop-group" data-area-precision-group="unclassified">
                  <h3 className="area-hub-shop-group__title">主な掲載エリアを確認中の店舗</h3>
                  <p className="area-hub-section__intro area-hub-section__intro--compact">
                    このエリアとの掲載関係はありますが、主な掲載エリアはまだ確認できていません。
                  </p>
                  <SecondaryShopLinks shops={precisionGroups.unclassified} />
                </section>
              ) : null}
            </div>
          ) : null}
        </AreaHubSectionShell>

        <AreaHubCompareTabsSections
          rankingShops={mainShops}
          targetArea={area}
          hubContext={hubContext}
          precisionMode={precisionMode}
          capabilities={capabilities}
        />
        <AreaLatestReviews shops={mainShops} hubContext={hubContext} />
        <AreaHubPriceAndGuideSections
          rankingShops={mainShops}
          hubContext={hubContext}
          precisionMode={precisionMode}
        />
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
