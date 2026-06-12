import Link from "next/link";
import { AreaQuickLinks } from "@/components/AreaQuickLinks";
import { ShopContactCtaPanel, ShopContactFixedBar } from "@/components/ShopContactCta";
import { shopLocalBusinessJsonLd } from "@/lib/seo";
import { phoneHref, shopField } from "@/lib/shop-contact";
import type { AreaView, ShopView } from "@/lib/wp/types";

const fallbackImage = "/no-image.svg";

function field(shop: ShopView, key: string, fallback = "") {
  return shopField(shop, key, fallback);
}

function resolveShopAreaNav(shop: ShopView, allAreas: AreaView[], parentArea?: AreaView | null) {
  const fromCatalog = shop.areaSlug ? allAreas.find((a) => a.slug === shop.areaSlug) : undefined;
  const fromTerms = shop.areaSlug ? shop.terms.find((t) => t.slug === shop.areaSlug) : undefined;
  const fallbackTerm = shop.terms.length > 0 ? shop.terms[shop.terms.length - 1] : undefined;

  const areaSlugForNav =
    shop.areaSlug || fromCatalog?.slug || fromTerms?.slug || fallbackTerm?.slug || parentArea?.slug;
  const areaName =
    fromCatalog?.name || fromTerms?.name || fallbackTerm?.name || parentArea?.name || "エリア";

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
  const image = shop.imageUrl || fallbackImage;
  const tel = field(shop, "shop_tel");
  const line = field(shop, "shop_line");
  const officialUrl = shop.officialUrl || field(shop, "official_url");
  const summary = field(shop, "shop_ai_summary");
  const todayAnalysis = field(shop, "shop_today_analysis");
  const recommend = field(shop, "recommend_text");
  const rate = field(shop, "review_star", "4.0");
  const { areaName, areaSlugForNav } = resolveShopAreaNav(shop, allAreas, parentArea);

  const ages = [
    ["18〜19歳", Number(field(shop, "age_18_19") || field(shop, "age_18") || 0)],
    ["20〜24歳", Number(field(shop, "age_20_24") || field(shop, "age_20") || 0)],
    ["25〜29歳", Number(field(shop, "age_25_29") || field(shop, "age_25") || 0)],
    ["30〜34歳", Number(field(shop, "age_30_34") || field(shop, "age_30") || 0)],
    ["35〜39歳", Number(field(shop, "age_35_39") || field(shop, "age_35") || 0)],
    ["40〜44歳", Number(field(shop, "age_40_44") || field(shop, "age_40") || 0)],
    ["45歳〜", Number(field(shop, "age_45_plus") || 0)]
  ];
  const maxAge = Math.max(...ages.map(([, count]) => Number(count)), 1);

  const shopPrice60 = Number(field(shop, "shop_price_60min") || field(shop, "price_60") || field(shop, "basic_price") || 0);
  const areaAvg60 = Number(field(shop, "area_average_60min") || 12000);

  const priceFields = [
    ["price_50", "50分"],
    ["price_60", "60分"],
    ["price_70", "70分"],
    ["price_80", "80分"],
    ["price_90", "90分"],
    ["price_120", "120分"],
    ["price_150", "150分"]
  ] as const;
  const prices = priceFields
    .map(([key, label]) => [label, field(shop, key)] as const)
    .filter(([, value]) => value);

  const feats = shop.terms.filter((t) => t.parent === 0 || shop.terms.length <= 3);

  return (
    <main id="main_content" className="l-mainContent l-article hl-shop-page hl-shop-page--has-fixed-cta">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(shopLocalBusinessJsonLd(shop))
        }}
      />
      <div className="l-mainContent__inner">
        <div className="shop-breadcrumb area-breadcrumb u-mb-20">
          <Link href="/">ホーム</Link> &gt; <Link href="/shops/">店舗情報</Link> &gt;{" "}
          <span>{shop.title}</span>
        </div>

        <article className="shop-detail-container hl-fade-in">
          <header className="shpc-header-box">
            <div className="shpc-top-bar" />
            <div className="shpc-header-content">
              <div className="shpc-header-top-row">
                <div className="shpc-header-left">
                  <div className="shpc-shop-name-row">
                    <span className="shpc-badge-open">OPEN</span>
                    <h1 className="shpc-shop-name">{shop.title}</h1>
                  </div>
                  {shop.terms.length > 0 ? (
                    <div className="shpc-cats">
                      {shop.terms.slice(0, 5).map((term) => (
                        <span key={`${shop.id}-${term.id}`}>{term.name}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="shpc-header-right">
                  {officialUrl ? (
                    <a className="shpc-link-btn" href={officialUrl} target="_blank" rel="noreferrer">
                      WEB
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <section className="shpc-intro-section">
            <div className="shpc-intro-image">
              <img
                src={image}
                alt={shop.title}
                width={800}
                height={533}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <div className="shpc-intro-content">
              <div className="shpc-stars">
                <span className="star-icon">★★★★☆</span>
                <span className="rate-num">{rate}</span>
              </div>
              <div className="hl-gold-divider" />
              {field(shop, "shop_catch") ? (
                <div className="shpc-intro-heading">{field(shop, "shop_catch")}</div>
              ) : null}
              {shop.contentHtml ? (
                <div className="shpc-intro-text" dangerouslySetInnerHTML={{ __html: shop.contentHtml }} />
              ) : null}
              <div className="shpc-cta-row">
                {tel ? (
                  <a className="shpc-btn-tel" href={phoneHref(tel)}>
                    電話予約
                  </a>
                ) : null}
                {line ? (
                  <a className="shpc-btn-line" href={line} target="_blank" rel="noreferrer">
                    LINE予約
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          {summary ? (
            <section className="shop-info-section ai-intelligence-view u-mt-40 u-mb-50">
              <div className="ai-intel-wrapper">
                <div className="ai-intel-header">
                  <span className="ai-intel-badge">
                    <span className="ai-intel-icon" aria-hidden="true">
                      🖋
                    </span>
                    Escomi編集部 Review
                  </span>
                </div>
                <div className="ai-intel-summary">
                  <h3 className="ai-intel-subtitle">
                    <span className="ai-intel-subicon" />
                    店舗コンセプト・概要
                  </h3>
                  <div
                    className="ai-intel-summary-content"
                    dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, "<br />") }}
                  />
                </div>
                <p className="ai-intel-footer-note">
                  ※ Escomi編集部が独自の視点で店舗の魅力を分析しています。
                </p>
              </div>
            </section>
          ) : null}

          <section className="shop-info-section hl-attendance-placeholder">
            <h2 className="mod-customColor es-sec-title">
              <span className="es-sec-title__ja">本日の出勤＆空き状況</span>
            </h2>
            <div className="hl-today-box">
              <p className="hl-today-label">TODAY&apos;S ANALYSIS</p>
              {todayAnalysis ? (
                <p>{todayAnalysis}</p>
              ) : (
                <p className="hl-today-note">
                  出勤情報は準備中です。詳細は店舗へ直接お問い合わせください。
                </p>
              )}
            </div>
          </section>

          <section className="shop-info-section">
            <h2 className="mod-customColor es-sec-title">
              <span className="es-sec-title__en">AGE RANGE</span>
              <span className="es-sec-title__ja">在籍セラピスト年齢層</span>
            </h2>
            <div className="es-age-graph-container">
              {ages.map(([label, count], index) => (
                <div className="es-age-bar-row" key={label}>
                  <div className="es-age-label">{label}</div>
                  <div className="es-bar-container">
                    <div
                      className={`es-bar es-bar-gold-${index % 5}`}
                      style={{ width: `${(Number(count) / maxAge) * 100}%` }}
                    />
                  </div>
                  <div className="es-bar-count">{count}名</div>
                </div>
              ))}
            </div>
          </section>

          <section className="shop-info-section">
            <h2 className="mod-customColor es-sec-title">
              <span className="es-sec-title__en">PRICE COMPARISON</span>
              <span className="es-sec-title__ja">エリア平均料金との比較</span>
            </h2>
            <div className="es-price-legend">
              <span className="es-legend-item es-legend-avg">
                <span className="es-legend-color" />
                {areaName}平均
              </span>
              <span className="es-legend-item es-legend-shop">
                <span className="es-legend-color" />
                当店
              </span>
            </div>
            <div className="es-price-comparison">
              {shopPrice60 > 0 ? (
                <div className="es-comp-group">
                  <h4 className="es-comp-time">60分</h4>
                  <div className="es-comp-bars">
                    <div
                      className="es-comp-bar es-comp-bar-avg"
                      style={{
                        height: `${(areaAvg60 / Math.max(areaAvg60, shopPrice60)) * 100}%`
                      }}
                    >
                      <span className="es-comp-bar-val">¥{areaAvg60.toLocaleString("ja-JP")}</span>
                    </div>
                    <div
                      className="es-comp-bar es-comp-bar-shop"
                      style={{
                        height: `${(shopPrice60 / Math.max(areaAvg60, shopPrice60)) * 100}%`
                      }}
                    >
                      <span className="es-comp-bar-val">¥{shopPrice60.toLocaleString("ja-JP")}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="hl-price-empty">料金比較データは準備中です。</p>
              )}
            </div>
          </section>

          {prices.length > 0 ? (
            <section className="shop-price-section u-mb-50">
              <h2 className="sec-title-simple shop-sec-title">
                <span className="en">PRICE LIST</span>
                <span className="ja">基本料金詳細</span>
              </h2>
              <div className="shop-detail-price-table-wrap">
                <table className="shop-detail-price-table">
                  <tbody>
                    {prices.map(([label, value]) => (
                      <tr key={label}>
                        <td className="cell-course">{label}</td>
                        <td className="cell-price">
                          <span className="course-price">
                            {Number(value).toLocaleString("ja-JP")}
                          </span>
                          <span className="unit">円</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {recommend ? (
            <section className="shop-info-section">
              <h2 className="mod-customColor es-sec-title">
                <span className="es-sec-title__en">RECOMMEND</span>
                <span className="es-sec-title__ja">この店舗の推しポイント</span>
              </h2>
              <div
                className="recommend-box"
                dangerouslySetInnerHTML={{ __html: recommend.replace(/\n/g, "<br />") }}
              />
            </section>
          ) : null}

          <section className="shop-info-section">
            <h2 className="mod-customColor es-sec-title">
              <span className="es-sec-title__en">SHOP INFO</span>
              <span className="es-sec-title__ja">店舗詳細データ</span>
            </h2>
            <table className="shop-data-table">
              <tbody>
                {officialUrl ? (
                  <tr>
                    <th>公式サイト</th>
                    <td>
                      <a href={officialUrl} target="_blank" rel="noreferrer">
                        公式サイトを見る
                      </a>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th>住所</th>
                  <td>{field(shop, "shop_address", "未登録")}</td>
                </tr>
                <tr>
                  <th>電話番号</th>
                  <td>
                    {tel ? (
                      <a href={phoneHref(tel)} className="tel-text">
                        {tel}
                      </a>
                    ) : (
                      "未登録"
                    )}
                  </td>
                </tr>
                <tr>
                  <th>営業時間</th>
                  <td>{field(shop, "shop_hours", "未登録")}</td>
                </tr>
                <tr>
                  <th>定休日</th>
                  <td>{field(shop, "shop_holiday", "不定休")}</td>
                </tr>
                <tr>
                  <th>予約</th>
                  <td>{field(shop, "shop_booking", "完全予約制")}</td>
                </tr>
                <tr>
                  <th>駐車場</th>
                  <td>{field(shop, "shop_parking", "なし")}</td>
                </tr>
                <tr>
                  <th>こだわり</th>
                  <td>
                    <div className="shop-feat-tags">
                      {feats.map((feat) => (
                        <span key={feat.id}>{feat.name}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <ShopContactCtaPanel shop={shop} />

          <AreaQuickLinks
            areas={allAreas}
            current={areaSlugForNav}
            title="エリアから探す"
            className="u-mt-50"
          />
        </article>
      </div>
      <ShopContactFixedBar shop={shop} />
    </main>
  );
}
