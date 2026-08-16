import Link from "next/link";
import { ShopDetailActions } from "@/components/shop-detail/ShopDetailActions";
import { ShopDetailGallery } from "@/components/shop-detail/ShopDetailGallery";
import { ShopDetailHero } from "@/components/shop-detail/ShopDetailHero";
import { ShopDetailSections } from "@/components/shop-detail/ShopDetailSections";
import { ShopOwnerCta } from "@/components/shop-detail/ShopOwnerCta";
import { ShopRelatedLinks } from "@/components/shop-detail/ShopRelatedLinks";
import { ShopSectionNav } from "@/components/shop-detail/ShopSectionNav";
import styles from "@/components/shop-detail/ShopDetail.module.css";
import { serializeJsonLd } from "@/lib/json-ld";
import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import { shopBreadcrumbJsonLd, shopLocalBusinessJsonLd } from "@/lib/seo";
import {
  buildShopInformationCoverage
} from "@/lib/shop-information-coverage";
import {
  buildShopSectionLinks,
  getVisibleShopDetailModules,
  type ShopDetailModuleContext
} from "@/lib/shop-detail-modules";
import { buildShopReviewViewModel } from "@/lib/shop-review-view-model";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type { ApprovedShopReviewResult, AreaView, ShopView } from "@/lib/wp/types";

export function ShopDetail({
  shop,
  parentArea,
  reviewResult
}: {
  shop: ShopView;
  parentArea?: AreaView | null;
  reviewResult: ApprovedShopReviewResult;
}) {
  const primaryArea = shop.primaryArea;
  const areaName = primaryArea?.name ?? "";
  const model = buildShopDetailViewModel(shop, areaName);
  const reviewModel = buildShopReviewViewModel(reviewResult);
  const officialRel = outboundRelForPromotion(shop.ranking.promotion);
  const reviewSubmitUrl = buildReviewSubmitUrl(shop.slug);
  const shopSchema = shopLocalBusinessJsonLd(shop, reviewModel);
  const breadcrumbSchema = shopBreadcrumbJsonLd(shop, parentArea);
  const areaPath = primaryArea ? `/area/${primaryArea.slug}/` : "";
  const coverage = buildShopInformationCoverage(
    model,
    shop.acf.shop_fact_provenance
  );
  const moduleContext: ShopDetailModuleContext = {
    model,
    review: reviewModel,
    coverage,
    hasNearby: true
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbSchema)
        }}
      />
      <div className={styles.shell}>
        <nav className="shop-breadcrumb area-breadcrumb" aria-label="パンくず">
          <Link href="/">ホーム</Link> &gt; <Link href="/shops/">店舗情報</Link> &gt;{" "}
          {parentArea ? (
            <>
              <Link href={`/area/${parentArea.slug}/`}>{parentArea.name}</Link> &gt;{" "}
            </>
          ) : null}
          {areaPath && primaryArea ? (
            <>
              <Link href={areaPath}>{primaryArea.name}</Link> &gt;{" "}
            </>
          ) : null}
          <span>{shop.title}</span>
        </nav>
        <article className={styles.detailGrid} data-shop-profile-grid="true">
          <section className={styles.visual} aria-label="店舗画像">
            <ShopDetailGallery model={model} />
          </section>
          <ShopDetailHero model={model} review={reviewModel} rel={officialRel} />
          <div className={styles.detailContent}>
            <ShopSectionNav links={sectionLinks} />
            <ShopDetailSections
              context={moduleContext}
              modules={visibleModules}
              nearbyContent={
                <ShopRelatedLinks
                  primaryArea={primaryArea}
                  reviewSubmitUrl={reviewSubmitUrl}
                  shopSlug={shop.slug}
                  shopTitle={shop.title}
                />
              }
              reviewResult={reviewResult}
              reviewSubmitUrl={reviewSubmitUrl}
              rel={officialRel}
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
