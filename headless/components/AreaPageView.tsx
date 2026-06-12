import Link from "next/link";
import { AreaBreadcrumb, AreaHero } from "@/components/AreaHero";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { EsSectionTitle } from "@/components/SectionTitle";
import { ShopCard } from "@/components/ShopCard";
import { resolveMapEmbedUrl } from "@/lib/design-constants";
import { safeText } from "@/lib/wp/client";
import { areaBreadcrumbJsonLd, asFaqRows, faqJsonLd } from "@/lib/seo";
import type { AreaView, ShopView } from "@/lib/wp/types";

const SHOPS_PER_PAGE = 20;

export function AreaPageView({
  area,
  shops,
  childAreas,
  siblingAreas,
  parentArea
}: {
  area: AreaView;
  shops: ShopView[];
  childAreas: AreaView[];
  siblingAreas: AreaView[];
  parentArea?: AreaView | null;
}) {
  const isParentArea = area.parent === 0;
  const characteristics = safeText(area.acf.area_characteristics, area.description);
  const column = safeText(area.acf.area_column_content);
  const faqRows = asFaqRows(area.acf.area_faq_content);
  const mapUrl = isParentArea ? resolveMapEmbedUrl(area) : "";
  const totalPages = Math.max(1, Math.ceil(area.count / SHOPS_PER_PAGE));

  return (
    <main id="main_content" className="l-main_content l-article hl-area-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(areaBreadcrumbJsonLd(area, parentArea))
        }}
      />
      <AreaHero area={area} parent={parentArea} />

      <div className="l-main_content__inner hl-page-inner">
        <AreaBreadcrumb area={area} parent={parentArea} />

        {isParentArea && mapUrl && childAreas.length > 0 ? (
          <section className="area-map-section hl-section hl-fade-in">
            <div className="lux-area-nav lux-area-nav--map-focus">
              <div className="lux-map-section">
                <h2 className="lux-heading">
                  <span className="en">MAP SEARCH</span>
                  <span className="jp">周辺の位置関係（地図の範囲で目安）</span>
                </h2>
                <div className="lux-map-frame">
                  <iframe
                    className="lux-map-iframe"
                    src={mapUrl}
                    title={`${area.name}の地図`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {isParentArea && childAreas.length > 0 ? (
          <section className="child-area-select-section hl-section hl-fade-in">
            <h2 className="lux-heading-small">詳細エリアを選択</h2>
            <div className="es-area-grid u-pc-only">
              {childAreas.map((child) => (
                <Link className="es-area-link-item" key={child.id} href={`/area/${child.slug}/`}>
                  <span className="es-area-name">{child.name}</span>
                  <span className="es-area-count">{child.count}件</span>
                </Link>
              ))}
            </div>
            <div className="es-area-scroll-container sp-only">
              <p className="scroll-hint">横にスクロールできます ➡</p>
              <div className="es-area-scroll-wrapper">
                <div className="es-area-scroll-list">
                  {childAreas.map((child) => (
                    <Link className="es-area-scroll-item" key={child.id} href={`/area/${child.slug}/`}>
                      <span className="es-area-name">{child.name}</span>
                      <span className="es-area-count">{child.count}件</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!isParentArea && characteristics ? (
          <section className="area-characteristics-box hl-section hl-fade-in">
            <div dangerouslySetInnerHTML={{ __html: characteristics }} />
          </section>
        ) : null}

        <section className="shop-list-section hl-section hl-fade-in">
          <EsSectionTitle en="SHOP LIST" ja={`${area.name}の店舗一覧`} large />
          {shops.length > 0 ? (
            <>
              <div className="wolfman-list-container">
                {shops.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} compact />
                ))}
              </div>
              <Pagination currentPage={1} totalPages={totalPages} />
            </>
          ) : (
            <EmptyState title="店舗が見つかりません" text="WordPress側のエリア紐付けを確認してください。" />
          )}
        </section>

        {column ? (
          <section className="area-column-content hl-section">
            <EsSectionTitle en="AREA INFO" ja={`${area.name}エリアのメンズエステ情報`} large />
            <div className="area-column-content__body" dangerouslySetInnerHTML={{ __html: column }} />
          </section>
        ) : null}

        {faqRows.length > 0 ? (
          <section className="area-faq-box hl-section">
            <EsSectionTitle en="FAQ" ja="よくある質問" large />
            <dl className="area-faq-box__dl">
              {faqRows.map((row) => (
                <div key={row.question}>
                  <dt>{row.question}</dt>
                  <dd dangerouslySetInnerHTML={{ __html: row.answer }} />
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqRows)) }}
            />
          </section>
        ) : null}

        {!isParentArea && parentArea && siblingAreas.length > 0 ? (
          <section className="es-sibling-area-section hl-section hl-fade-in">
            <h2 className="sec-title-simple es-sec-title">
              <span className="es-sec-title__en">OTHER AREAS</span>
              <span className="es-sec-title__ja">{parentArea.name}の他のエリア</span>
            </h2>
            <div className="es-area-grid pc-only">
              <Link
                href={`/area/${parentArea.slug}/`}
                className="es-area-link-item es-area-link-all"
              >
                <span className="es-area-name">{parentArea.name}すべて</span>
                <span className="es-area-count">({parentArea.count}件)</span>
              </Link>
              {siblingAreas.map((sibling) => (
                <Link
                  className={`es-area-link-item ${sibling.slug === area.slug ? "is-current" : ""}`}
                  key={sibling.id}
                  href={`/area/${sibling.slug}/`}
                >
                  <span className="es-area-name">{sibling.name}</span>
                  <span className="es-area-count">({sibling.count}件)</span>
                </Link>
              ))}
              <Link className="es-area-link-item is-current" href={`/area/${area.slug}/`}>
                <span className="es-area-name">{area.name}</span>
                <span className="es-area-count">({area.count}件)</span>
              </Link>
            </div>
            <div className="es-area-scroll-container sp-only">
              <p className="scroll-hint">横にスクロールできます ➡</p>
              <div className="es-area-scroll-wrapper">
                <div className="es-area-scroll-list">
                  <Link href={`/area/${parentArea.slug}/`} className="es-area-scroll-item es-area-link-all">
                    <span className="es-area-name">すべて</span>
                    <span className="es-area-count">{parentArea.count}件</span>
                  </Link>
                  {[...siblingAreas, area].map((sibling) => (
                    <Link
                      className={`es-area-scroll-item ${sibling.id === area.id ? "is-current" : ""}`}
                      key={sibling.id}
                      href={`/area/${sibling.slug}/`}
                    >
                      <span className="es-area-name">{sibling.name}</span>
                      <span className="es-area-count">{sibling.count}件</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
