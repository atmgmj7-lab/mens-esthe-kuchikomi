import Link from "next/link";
import { AreaQuickLinks } from "@/components/AreaQuickLinks";
import { ShopAreaHubLinks } from "@/components/common/ShopAreaHubLinks";
import { ShopDetailActions } from "@/components/shop-detail/ShopDetailActions";
import { ShopDetailGallery } from "@/components/shop-detail/ShopDetailGallery";
import { ShopDetailHero } from "@/components/shop-detail/ShopDetailHero";
import { ShopDetailSections } from "@/components/shop-detail/ShopDetailSections";
import { ShopOwnerCta } from "@/components/shop-detail/ShopOwnerCta";
import { ShopSectionNav } from "@/components/shop-detail/ShopSectionNav";
import styles from "@/components/shop-detail/ShopDetail.module.css";
import { serializeJsonLd } from "@/lib/json-ld";
import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import { shopLocalBusinessJsonLd } from "@/lib/seo";
import {
  buildShopInformationCoverage,
  normalizeShopRankingSnapshot
} from "@/lib/shop-information-coverage";
import {
  buildShopSectionLinks,
  getVisibleShopDetailModules,
  type ShopDetailModuleContext
} from "@/lib/shop-detail-modules";
import { buildShopReviewViewModel } from "@/lib/shop-review-view-model";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type { ApprovedShopReviewResult, AreaView, ShopView } from "@/lib/wp/types";

function resolveShopAreaNav(
  shop: ShopView,
  allAreas: AreaView[],
  parentArea?: AreaView | null
) {
  const fromCatalog = shop.areaSlug
    ? allAreas.find((area) => area.slug === shop.areaSlug)
    : undefined;
  const fromTerms = shop.areaSlug
    ? shop.terms.find((term) => term.slug === shop.areaSlug)
    : undefined;
  const fallbackTerm =
    shop.terms.length > 0 ? shop.terms[shop.terms.length - 1] : undefined;

  const areaSlugForNav =
    shop.areaSlug ||
    fromCatalog?.slug ||
    fromTerms?.slug ||
    fallbackTerm?.slug ||
    parentArea?.slug;
  const areaName =
    fromCatalog?.name ||
    fromTerms?.name ||
    fallbackTerm?.name ||
    parentArea?.name ||
    "エリア";

  return { areaSlugForNav, areaName };
}

export function ShopDetail({
  shop,
  parentArea,
  allAreas = [],
  reviewResult
}: {
  shop: ShopView;
  parentArea?: AreaView | null;
  allAreas?: AreaView[];
  reviewResult: ApprovedShopReviewResult;
}) {
  const { areaName, areaSlugForNav } = resolveShopAreaNav(
    shop,
    allAreas,
    parentArea
  );
  const model = buildShopDetailViewModel(shop, areaName);
  const reviewModel = buildShopReviewViewModel(reviewResult);
  const officialRel = outboundRelForPromotion(shop.ranking.promotion);
  const reviewSubmitUrl = buildReviewSubmitUrl(shop.slug);
  const shopSchema = shopLocalBusinessJsonLd(shop, reviewModel);
  const shopAreaForHub = areaSlugForNav
    ? allAreas.find((area) => area.slug === areaSlugForNav)
    : undefined;
  const areaPath = areaSlugForNav ? `/area/${areaSlugForNav}/` : "";
  const coverage = buildShopInformationCoverage(
    model,
    shop.acf.shop_fact_provenance
  );
  const ranking = normalizeShopRankingSnapshot(
    shop.acf.shop_area_ranking_snapshot
  );
  const moduleContext: ShopDetailModuleContext = {
    model,
    review: reviewModel,
    coverage,
    ranking,
    hasNearby: Boolean(shopAreaForHub)
  };
  const visibleModules = getVisibleShopDetailModules(moduleContext);
  const sectionLinks = buildShopSectionLinks(visibleModules);

  return (
    <main
      id="main_content"
      data-shop-detail-root
      className={`l-mainContent hl-shop-page ${styles.page}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(shopSchema)
        }}
      />
      <div className={styles.shell}>
        <nav className="shop-breadcrumb area-breadcrumb" aria-label="パンくず">
          <Link href="/">ホーム</Link> &gt; <Link href="/shops/">店舗情報</Link> &gt;{" "}
          {areaPath ? (
            <>
              <Link href={areaPath}>{areaName}</Link> &gt;{" "}
            </>
          ) : null}
          <span>{shop.title}</span>
        </nav>
        <article className={styles.detailGrid} data-shop-profile-grid="true">
          <section className={styles.visual} aria-label="店舗画像">
            <ShopDetailGallery model={model} />
          </section>
          <ShopDetailHero model={model} rel={officialRel} />
          <div className={styles.detailContent}>
            <ShopSectionNav links={sectionLinks} />
            <ShopDetailSections
              context={moduleContext}
              modules={visibleModules}
              nearbyContent={
                shopAreaForHub ? (
                  <ShopAreaHubLinks area={shopAreaForHub} parentArea={parentArea} />
                ) : null
              }
              reviewResult={reviewResult}
              reviewSubmitUrl={reviewSubmitUrl}
              rel={officialRel}
            />
            <AreaQuickLinks
              areas={allAreas}
              current={areaSlugForNav}
              title="エリアから探す"
              className="u-mt-50"
            />
            <ShopOwnerCta shop={shop} />
          </div>
        </article>
      </div>
      <ShopDetailActions
        model={model}
        rel={officialRel}
        position="fixed"
        fixed
      />
    </main>
  );
}
