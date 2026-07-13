import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import Link from "next/link";
import { AreaQuickLinks } from "@/components/AreaQuickLinks";
import { RatingBadge } from "@/components/common/RatingBadge";
import { ShopAreaHubLinks } from "@/components/common/ShopAreaHubLinks";
import { ShopScheduleSnapshot } from "@/components/shop/ShopScheduleSnapshot";
import { ShopContactCtaPanel, ShopContactFixedBar } from "@/components/ShopContactCta";
import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
import { extractShopUserReviewItems, isNihonbashiShop } from "@/lib/area-shop-utils";
import { shopLocalBusinessJsonLd } from "@/lib/seo";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import { phoneHref, shopField } from "@/lib/shop-contact";
import { normalizeImageUrl } from "@/lib/wp/normalize";
import {
  formatPriceForDisplay,
  getMinimumConfirmedPrice,
  resolveShopCoursePrices
} from "@/lib/price-normalization";
import type { AreaView, ShopView } from "@/lib/wp/types";

const SHOP_VISUAL_KEYS = [
  "shop_header_image",
  "header_image",
  "shop_top_image",
  "top_image",
  "shop_hero_image",
  "hero_image",
  "shop_main_visual",
  "main_visual",
  "shop_image",
  "shop_main_image",
  "main_image",
  "image",
  "shop_photo",
  "photo",
  "gallery_image",
  "store_image",
  "thumbnail"
] as const;

function field(shop: ShopView, key: string, fallback = "") {
  return shopField(shop, key, fallback);
}

function extractVisualUrl(value: unknown): string {
  if (!value || typeof value === "number") return "";
  if (typeof value === "string") return value ? normalizeImageUrl(value) : "";
  if (typeof value !== "object") return "";

  const item = value as Record<string, unknown>;
  if (typeof item.url === "string" && item.url) return normalizeImageUrl(item.url);
  if (typeof item.source_url === "string" && item.source_url) return normalizeImageUrl(item.source_url);

  const sizes = item.sizes;
  if (sizes && typeof sizes === "object") {
    const sizesObject = sizes as Record<string, unknown>;
    for (const key of ["large", "medium_large", "medium", "full"]) {
      const size = sizesObject[key];
      if (typeof size === "string" && size) return normalizeImageUrl(size);
      if (size && typeof size === "object" && typeof (size as { url?: unknown }).url === "string") {
        return normalizeImageUrl((size as { url: string }).url);
      }
    }
  }

  return "";
}

function resolveShopVisuals(shop: ShopView): string[] {
  const candidates = [
    shop.imageUrl,
    ...SHOP_VISUAL_KEYS.map((key) => extractVisualUrl(shop.acf[key]))
  ]
    .filter(Boolean)
    .map((url) => url || DEFAULT_SHOP_IMAGE);

  const seen = new Set<string>();
  const unique = candidates.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  return unique.length > 0 ? unique.slice(0, 4) : [DEFAULT_SHOP_IMAGE];
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
  const image = shop.imageUrl || DEFAULT_SHOP_IMAGE;
  const shopVisuals = resolveShopVisuals(shop);
  const tel = field(shop, "shop_tel");
  const line = field(shop, "shop_line");
  const officialUrl = shop.officialUrl || field(shop, "official_url");
  const officialRel = outboundRelForPromotion(shop.ranking.promotion);
  const summary = field(shop, "shop_ai_summary");
  const recommend = field(shop, "recommend_text");
  const userReviews = extractShopUserReviewItems(shop);
  const isNihonbashi = isNihonbashiShop(shop);
  const { areaName, areaSlugForNav } = resolveShopAreaNav(shop, allAreas, parentArea);
  const areaLeadPrefix = areaName === "エリア" ? "掲載エリア" : `${areaName}周辺`;
  const areaLeadText = `${areaLeadPrefix}で検討しやすいメンズエステ店舗です。料金、営業時間、アクセス、口コミ投稿、編集部コメントを確認できます。`;
  const shopAreaForHub = areaSlugForNav
    ? allAreas.find((a) => a.slug === areaSlugForNav)
    : undefined;
  const areaPath = areaSlugForNav ? `/area/${areaSlugForNav}/` : "";

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

  const shopPrice60 = getMinimumConfirmedPrice(
    [field(shop, "shop_price_60min"), field(shop, "price_60"), field(shop, "basic_price")],
    "primary-course"
  ).amount;
  const areaAvg60 =
    getMinimumConfirmedPrice([field(shop, "area_average_60min")], "primary-course").amount ?? 12000;

  const prices = resolveShopCoursePrices(shop.acf);
  const primaryPriceLabel =
    shopPrice60 != null
      ? `60分 ${shopPrice60.toLocaleString("ja-JP")}円〜`
      : "料金は店舗へお問い合わせください。";
  const priceStatusLabel = shopPrice60 != null ? "料金確認済み" : "料金未確認";
  const reviewCountLabel = userReviews.length > 0 ? `${userReviews.length}件` : "承認済み口コミなし";
  const officialStatusLabel = officialUrl ? "公式導線あり" : "公式導線未確認";

  const feats = shop.terms.filter((t) => t.parent === 0 || shop.terms.length <= 3);

  return (
    <main id="main_content" className="l-mainContent l-article hl-shop-page hl-shop-page--has-fixed-cta escomi-final-shop-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(shopLocalBusinessJsonLd(shop))
        }}
      />
      <div className="l-mainContent__inner hl-page-inner escomi-final-shop-shell">
        <div className="shop-breadcrumb area-breadcrumb u-mb-20">
          <Link href="/">ホーム</Link> &gt; <Link href="/shops/">店舗情報</Link> &gt;{" "}
          {areaPath ? (
            <>
              <Link href={areaPath}>{areaName}</Link> &gt;{" "}
            </>
          ) : null}
          <span>{shop.title}</span>
        </div>

        <article className="shop-detail-container hl-fade-in escomi-final-shop-container">
          <header className="shpc-header-box escomi-final-shop-header">
            <div className="shpc-top-bar" />
            <div className="shpc-header-content">
              <div className="shpc-header-top-row">
                <div className="shpc-header-left">
                  <p className="escomi-final-shop-header__eyebrow">SHOP DETAIL</p>
                  <div className="shpc-shop-name-row">
                    <span className="shpc-badge-open">OPEN</span>
                    <h1 className="shpc-shop-name">{shop.title}</h1>
                  </div>
                  <p className="escomi-final-shop-header__area">{areaLeadText}</p>
                  {isNihonbashi ? (
                    <p className="shpc-area-subtext">
                      {areaLeadText}
                    </p>
                  ) : null}
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
                    <a className="shpc-link-btn" href={officialUrl} target="_blank" rel={officialRel}>
                      WEB
                    </a>
                  ) : null}
                </div>
              </div>
              <dl className="escomi-final-shop-header__stats" aria-label="店舗概要">
                <div>
                  <dt>料金目安</dt>
                  <dd>{primaryPriceLabel}</dd>
                </div>
                <div>
                  <dt>料金状態</dt>
                  <dd>{priceStatusLabel}</dd>
                </div>
                <div>
                  <dt>口コミ</dt>
                  <dd>{reviewCountLabel}</dd>
                </div>
                <div>
                  <dt>予約導線</dt>
                  <dd>{officialStatusLabel}</dd>
                </div>
              </dl>
              <p className="escomi-final-shop-header__source-note">
                ユーザー口コミ、編集部コメント、店舗提供情報、PR情報は分けて掲載しています。最新の料金・空き状況は公式情報で確認してください。
              </p>
            </div>
          </header>

          <section className="shpc-intro-section escomi-final-shop-intro escomi-final-shop-visual-deck">
            <div className="shpc-intro-image">
              <img
                src={shopVisuals[0] || image}
                alt={shop.title}
                width={800}
                height={533}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              {shopVisuals.length > 1 ? (
                <div className="escomi-final-shop-visual-deck__thumbs" aria-label="店舗画像">
                  {shopVisuals.slice(1).map((visual, index) => (
                    <img
                      key={`${shop.id}-visual-${index}`}
                      src={visual}
                      alt={`${shop.title} 店舗画像 ${index + 2}`}
                      width={180}
                      height={120}
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="shpc-intro-content">
              <RatingBadge shop={shop} className="shpc-stars" />
              <div className="hl-gold-divider" />
              <div className="escomi-final-shop-intro__quick-nav" aria-label="店舗詳細内メニュー">
                <a href="#shop-price">料金表</a>
                <a href="#shop-reviews">口コミ</a>
                <a href="#shop-data">基本情報</a>
                <a href="#shop-contact">予約・問い合わせ</a>
                {areaPath ? (
                  <>
                    <Link href={`${areaPath}#ranking`}>同エリアランキング</Link>
                    <Link href={`${areaPath}#price-table`}>同エリア料金比較</Link>
                  </>
                ) : null}
                <Link href={buildReviewSubmitUrl(shop.slug)}>口コミ投稿</Link>
              </div>
              <dl className="escomi-final-shop-trust-rail" aria-label="確認しやすい店舗情報">
                <div>
                  <dt>料金</dt>
                  <dd>{primaryPriceLabel}</dd>
                </div>
                <div>
                  <dt>口コミ</dt>
                  <dd>{reviewCountLabel}</dd>
                </div>
                <div>
                  <dt>予約</dt>
                  <dd>{officialStatusLabel}</dd>
                </div>
              </dl>
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
            <section className="shop-info-section ai-intelligence-view hl-section">
              <div className="ai-intel-wrapper">
                <div className="ai-intel-header">
                  <span className="ai-intel-badge">
                    <span className="ai-intel-icon" aria-hidden="true">
                      NOTE
                    </span>
                    掲載情報コメント
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
                  ※ 公開情報をもとに整理したコメントです。ユーザー口コミではありません。
                </p>
              </div>
            </section>
          ) : null}

          <ShopScheduleSnapshot shop={shop} />

          <section className="shop-info-section hl-section">
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

          <section className="shop-info-section hl-section">
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
              {shopPrice60 != null ? (
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

          <div className="escomi-final-shop-sections-grid">
            {prices.length > 0 ? (
              <section id="shop-price" className="shop-price-section hl-section escomi-final-shop-section">
                <h2 className="sec-title-simple shop-sec-title">
                  <span className="en">PRICE LIST</span>
                  <span className="ja">基本料金詳細</span>
                </h2>
                <div className="shop-detail-price-table-wrap">
                  <table className="shop-detail-price-table">
                    <tbody>
                      {prices.map(({ key, label, price }) => (
                        <tr key={key}>
                          <td className="cell-course">{label}</td>
                          <td className="cell-price">
                            <span className="course-price">
                              {formatPriceForDisplay(price)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section id="shop-price" className="shop-price-section hl-section escomi-final-shop-section">
                <h2 className="sec-title-simple shop-sec-title">
                  <span className="en">PRICE LIST</span>
                  <span className="ja">基本料金詳細</span>
                </h2>
                <p className="hl-price-empty">料金は店舗へお問い合わせください。</p>
              </section>
            )}

            {recommend ? (
              <section className="shop-info-section hl-section escomi-final-shop-section">
                <h2 className="mod-customColor es-sec-title">
                  <span className="es-sec-title__en">RECOMMEND</span>
                  <span className="es-sec-title__ja">店舗紹介・推しポイント</span>
                </h2>
                <div
                  className="recommend-box"
                  dangerouslySetInnerHTML={{ __html: recommend.replace(/\n/g, "<br />") }}
                />
              </section>
            ) : null}

            <section id="shop-reviews" className="shop-info-section hl-section escomi-final-shop-section">
            <h2 className="mod-customColor es-sec-title">
              <span className="es-sec-title__en">USER REVIEWS</span>
              <span className="es-sec-title__ja">ユーザー口コミ</span>
            </h2>
            {userReviews.length > 0 ? (
              <div className="hl-user-review-list">
                {userReviews.map((review, index) => (
                  <article className="hl-user-review-card" key={review.id ?? `${shop.id}-review-${index}`}>
                    <p className="hl-user-review-card__body">{review.body}</p>
                    <p className="hl-user-review-card__meta">
                      {review.authorName ?? "匿名"}
                      {review.submittedAt ? ` / ${review.submittedAt}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="hl-review-form__lead">
                この店舗の承認済みユーザー口コミはまだありません。
              </p>
            )}
            <p className="hl-review-form__notice">
              掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません。
            </p>
            </section>

            <section id="shop-data" className="shop-info-section hl-section escomi-final-shop-section">
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
                      <a href={officialUrl} target="_blank" rel={officialRel}>
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

            <section className="shop-info-section hl-section hl-review-submit-section escomi-final-shop-section">
            <h2 className="mod-customColor es-sec-title">
              <span className="es-sec-title__en">USER REVIEW</span>
              <span className="es-sec-title__ja">口コミ投稿</span>
            </h2>
            <p className="hl-review-form__lead">
              実際に利用した方の口コミを募集しています。投稿内容は運営側で確認後、掲載されます。
            </p>
            <Link href={buildReviewSubmitUrl(shop.slug)} className="area-hub-btn area-hub-btn--primary">
              この店舗の口コミを投稿する
            </Link>
            <p className="hl-review-form__notice">
              個人情報、誹謗中傷、事実確認が難しい内容、過度な表現は掲載できない場合があります。
            </p>
            </section>

            <ShopContactCtaPanel shop={shop} />
          </div>

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
      <ShopContactFixedBar shop={shop} />
    </main>
  );
}
