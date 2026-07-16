import Link from "next/link";
import { AreaQuickLinks } from "@/components/AreaQuickLinks";
import { ShopAreaHubLinks } from "@/components/common/ShopAreaHubLinks";
import { ShopDetailActions } from "@/components/shop-detail/ShopDetailActions";
import { ShopDetailGallery } from "@/components/shop-detail/ShopDetailGallery";
import { ShopDetailHero } from "@/components/shop-detail/ShopDetailHero";
import { ShopDetailSections } from "@/components/shop-detail/ShopDetailSections";
import { ShopOwnerCta } from "@/components/shop-detail/ShopOwnerCta";
import styles from "@/components/shop-detail/ShopDetail.module.css";
import { extractShopUserReviewItems } from "@/lib/area-shop-utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import { shopLocalBusinessJsonLd } from "@/lib/seo";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type { AreaView, ShopView } from "@/lib/wp/types";

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
  allAreas = []
}: {
  shop: ShopView;
  parentArea?: AreaView | null;
  allAreas?: AreaView[];
}) {
  const { areaName, areaSlugForNav } = resolveShopAreaNav(
    shop,
    allAreas,
    parentArea
  );
  const model = buildShopDetailViewModel(shop, areaName);
  const officialRel = outboundRelForPromotion(shop.ranking.promotion);
  const userReviews = extractShopUserReviewItems(shop);
  const reviewSubmitUrl = buildReviewSubmitUrl(shop.slug);
  const shopSchema = shopLocalBusinessJsonLd(shop);
  const shopAreaForHub = areaSlugForNav
    ? allAreas.find((area) => area.slug === areaSlugForNav)
    : undefined;
  const areaPath = areaSlugForNav ? `/area/${areaSlugForNav}/` : "";

  return (
    <main
      id="main_content"
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
        <article>
          <ShopDetailHero model={model} rel={officialRel} />
          <section
            className={styles.visual}
            aria-label="店舗画像とページ内メニュー"
          >
            <ShopDetailGallery model={model} />
            <aside className={styles.visualAside}>
              <p className={styles.kicker}>AT A GLANCE</p>
              <h2>先に知りたい情報を、迷わず確認。</h2>
              <nav className={styles.quickLinks} aria-label="店舗詳細内メニュー">
                {model.prices.length > 0 ? (
                  <a href="#shop-price">料金プラン</a>
                ) : null}
                {model.infoRows.length > 0 ? (
                  <a href="#shop-data">アクセス・基本情報</a>
                ) : null}
                <a href="#shop-reviews">ユーザー口コミ</a>
                {areaPath ? (
                  <>
                    <Link href={`${areaPath}#ranking`}>同エリアランキング</Link>
                    <Link href={`${areaPath}#price-table`}>同エリア料金比較</Link>
                  </>
                ) : null}
              </nav>
              <ShopDetailActions
                model={model}
                rel={officialRel}
                position="body"
              />
            </aside>
          </section>
          <ShopDetailSections
            model={model}
            reviews={userReviews}
            reviewSubmitUrl={reviewSubmitUrl}
            rel={officialRel}
          />
          <ShopOwnerCta shop={shop} />
          {shopAreaForHub ? (
            <ShopAreaHubLinks area={shopAreaForHub} parentArea={parentArea} />
          ) : null}
          <AreaQuickLinks
            areas={allAreas}
            current={areaSlugForNav}
            title="エリアから探す"
            className="u-mt-50"
          />
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
