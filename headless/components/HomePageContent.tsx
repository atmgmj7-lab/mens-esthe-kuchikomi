import Link from "next/link";
import { AreaFeatureSection } from "@/components/AreaFeatureSection";
import { KansaiAreaGrid } from "@/components/KansaiAreaGrid";
import { DEFAULT_SHOP_IMAGE, type AreaFeatureItem } from "@/lib/design-constants";
import type { AreaView, BlogPostView, ShopView } from "@/lib/wp/types";

type HomePageDataState = {
  shopCountFailed: boolean;
  shopsFailed: boolean;
  areasFailed: boolean;
  postsFailed: boolean;
};

const CONDITION_CARDS = [
  {
    label: "料金確認済み",
    count: "214店舗",
    tone: "price",
    description: "料金目安を確認済み",
    href: "/area/nihonbashi/?filter=price-confirmed"
  },
  {
    label: "深夜営業",
    count: "96店舗",
    tone: "night",
    description: "夜の利用候補",
    href: "/area/nihonbashi/?filter=late-night"
  },
  {
    label: "駅近（徒歩5分）",
    count: "173店舗",
    tone: "station",
    description: "移動しやすい店舗",
    href: "/area/nihonbashi/?filter=station"
  },
  {
    label: "初心者向け",
    count: "88店舗",
    tone: "beginner",
    description: "初回でも選びやすい",
    href: "/area/nihonbashi/?filter=beginner"
  },
  {
    label: "口コミあり",
    count: "167店舗",
    tone: "reviews",
    description: "利用者投稿を確認",
    href: "/area/nihonbashi/?filter=reviews"
  },
  {
    label: "公式サイトあり",
    count: "241店舗",
    tone: "official",
    description: "公式情報へ移動可能",
    href: "/area/nihonbashi/?filter=official"
  }
] as const;

const INFORMATION_LABELS = [
  { label: "ユーザー口コミ", text: "承認済みの利用者投稿のみ。評価集計は3件以上で表示。", tone: "review" },
  { label: "編集部コメント", text: "編集部の調査・確認に基づく記述。口コミとは集計しません。", tone: "editorial" },
  { label: "店舗提供情報", text: "店舗から提供された情報。提供元を明示します。", tone: "official" },
  { label: "AI要約", text: "生成元と情報源が明確な場合のみ、AI要約と明示して表示。", tone: "ai" },
  { label: "PR", text: "有料掲載。自然な検索結果・ランキングとは分離して表示。", tone: "pr" }
] as const;

const UPDATE_BADGES = ["新規掲載", "料金更新", "営業時間更新", "公式情報確認", "店舗情報更新"] as const;

const HERO_BACKGROUND_SLIDES = [
  {
    src: "/images/home-hero/osaka-night-alley-lanterns.jpg",
    alt: "大阪の夜の路地に提灯と飲食店の灯りが並ぶ街並み"
  },
  {
    src: "/images/home-hero/kansai-night-station-street.jpg",
    alt: "関西の駅前通りにネオンと人通りが広がる夜景"
  },
  {
    src: "/images/home-hero/kansai-night-food-street.webp",
    alt: "関西の夜の商店街に飲食店の明かりが続く街並み"
  },
  {
    src: "/images/home-hero/osaka-night-sign-street.jpg",
    alt: "大阪の夜の繁華街に看板が並ぶ街並み"
  },
  {
    src: "/images/home-hero/osaka-senba-night-road.jpg",
    alt: "大阪船場周辺の高架と街明かりの夜景"
  }
] as const;

const DEFAULT_DATA_STATE: HomePageDataState = {
  shopCountFailed: false,
  shopsFailed: false,
  areasFailed: false,
  postsFailed: false
};

function shopAreaName(shop: ShopView, areas: AreaView[]) {
  return areas.find((area) => area.slug === shop.areaSlug)?.name || shop.terms[0]?.name || "関西";
}

export function HomePageContent({
  shopCount,
  shops,
  areas,
  areaFeatures,
  dataState = DEFAULT_DATA_STATE
}: {
  shopCount: number;
  shops: ShopView[];
  areas: AreaView[];
  areaFeatures: AreaFeatureItem[];
  posts: BlogPostView[];
  dataState?: HomePageDataState;
}) {
  const totalShopCount = dataState.shopCountFailed ? null : shopCount || shops.length;
  const updatedShops = shops.slice(0, 5);

  return (
    <main id="main_content" className="l-mainContent escomi-home-final-v2">
      <section className="escomi-home-hero-v2 hl-fade-in" aria-labelledby="home-hero-title">
        <div className="escomi-home-hero-v2__slideshow" aria-hidden="true">
          {HERO_BACKGROUND_SLIDES.map((slide) => (
            <span
              className="escomi-home-hero-v2__slide"
              key={slide.src}
              role="img"
              aria-label={slide.alt}
              style={{ backgroundImage: `url(${slide.src})` }}
            />
          ))}
        </div>
        <div className="escomi-home-container-v2 escomi-home-hero-v2__grid">
          <div className="escomi-home-hero-v2__copy">
            <p className="escomi-home-eyebrow-v2">KANSAI MEN&apos;S ESTHE REVIEW &amp; SEARCH</p>
            <h1 id="home-hero-title" className="escomi-home-hero-v2__title">
              関西メンズエステ口コミナビ
            </h1>
            <p className="escomi-home-hero-v2__lead">
              大阪・京都・兵庫を中心に、料金・営業時間・口コミを地域別に整理。
              ユーザー口コミ、編集部コメント、店舗提供情報、PRを区別して比較できます。
            </p>
            <form className="escomi-home-search-v2" action="/shops/" method="get" role="search">
              <label className="sr-only" htmlFor="home-shop-search">
                エリア名・駅名・店舗名で探す
              </label>
              <input
                id="home-shop-search"
                className="escomi-home-search-v2__input"
                type="search"
                name="q"
                placeholder="エリア名・駅名・店舗名で探す（例：日本橋）"
                autoComplete="off"
              />
              <button className="escomi-home-search-v2__button" type="submit">検索</button>
            </form>
            <div className="escomi-home-search-feedback-v2" data-state-template="search-empty" hidden>
              <strong>「さかいひがし 温泉」に一致する候補が見つかりませんでした。</strong>
              <p>近い候補：堺東エリア・堺エリア</p>
              <Link href="/area/">エリア一覧から探す →</Link>
            </div>
            <nav className="escomi-home-popular-v2" aria-label="人気の条件">
              <span>人気の条件：</span>
              {CONDITION_CARDS.slice(0, 4).map((condition) => (
                <Link href={condition.href} key={condition.label}>{condition.label}</Link>
              ))}
            </nav>
          </div>

          <aside className="escomi-home-stat-panel-v2" aria-label="掲載情報の集計">
            {dataState.shopCountFailed ? (
              <div className="escomi-home-state-card-v2 escomi-home-state-card-v2--error">
                <strong>店舗数の取得に失敗しました</strong>
                <p>エリア一覧は表示できます。件数は再読み込みで再取得してください。</p>
                <Link href="/">再読み込み</Link>
              </div>
            ) : (
              <>
                <div className="escomi-home-stat-panel-v2__main">
                  <span>掲載店舗数</span>
                  <strong>{totalShopCount}</strong>
                  <span>店舗</span>
                </div>
                <dl>
                  <div>
                    <dt>料金確認済み</dt>
                    <dd>214店舗</dd>
                  </div>
                  <div>
                    <dt>承認済み口コミ</dt>
                    <dd>1,048件</dd>
                  </div>
                  <div>
                    <dt>最終更新</dt>
                    <dd>2026.07.11</dd>
                  </div>
                </dl>
                <p>口コミは承認済みのユーザー投稿のみを集計。編集部コメント・店舗提供情報・PRは口コミに含めません。</p>
              </>
            )}
          </aside>
        </div>
      </section>

      {dataState.areasFailed ? (
        <section className="escomi-home-prefectures-v2 hl-fade-in" aria-label="都道府県の読み込み状態">
          <div className="escomi-home-container-v2">
            <div className="escomi-home-inline-alert-v2">
              <strong>店舗数の取得に失敗しました</strong>
              <p>都道府県の導線は利用できます。件数のみ再取得が必要です。</p>
            </div>
          </div>
        </section>
      ) : null}
      <KansaiAreaGrid areas={areas} />
      <AreaFeatureSection areas={areas} features={areaFeatures} />

      <section className="escomi-home-conditions-v2 hl-fade-in" aria-labelledby="home-condition-title">
        <div className="escomi-home-container-v2">
          <div className="escomi-home-section-head-v2">
            <h2 id="home-condition-title">条件から探す</h2>
            <p>料金確認済み・深夜営業・駅近など、希望に近い条件から店舗一覧へ進めます。</p>
          </div>
          <div className="escomi-condition-grid-v2">
            {CONDITION_CARDS.map((condition) => (
              <Link
                className={`escomi-condition-card-v2 escomi-condition-card-v2--${condition.tone}`}
                href={condition.href}
                key={condition.label}
              >
                <span className="escomi-condition-card-v2__visual" aria-hidden="true" />
                <span className="escomi-condition-card-v2__body">
                  <strong>{condition.label}</strong>
                  <small>{condition.description}</small>
                  <em>{condition.count}</em>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="escomi-home-updated-v2 hl-fade-in" aria-labelledby="home-updated-title">
        <div className="escomi-home-container-v2">
          <div className="escomi-home-section-head-v2 escomi-home-section-head-v2--split">
            <div>
              <h2 id="home-updated-title">情報が更新された店舗</h2>
              <p>新着だけでなく、料金・営業時間・公式情報の確認日を重視して表示します。</p>
            </div>
            <Link href="/shops/">更新履歴をもっと見る →</Link>
          </div>
          <div className="escomi-updated-grid-v2">
            {dataState.shopsFailed || updatedShops.length === 0 ? (
              <div className="escomi-home-empty-state-v2">
                <strong>{dataState.shopsFailed ? "更新情報を読み込めませんでした" : "直近の更新情報はありません"}</strong>
                <p>{dataState.shopsFailed ? "時間をおいて再読み込みしてください。" : "新しい更新が入るまで、エリアから店舗を探せます。"}</p>
                <Link href="/area/">エリアから店舗を探す →</Link>
              </div>
            ) : (
              updatedShops.map((shop, index) => (
                <Link className="escomi-updated-card-v2" href={`/shops/${shop.slug}/`} key={shop.id}>
                  <img
                    className="escomi-updated-card-v2__image"
                    src={shop.imageUrl || DEFAULT_SHOP_IMAGE}
                    alt={shop.title}
                    width={360}
                    height={210}
                    loading="eager"
                    decoding="async"
                  />
                  <span>{UPDATE_BADGES[index % UPDATE_BADGES.length]}</span>
                  <strong>{shop.title}</strong>
                  <em>{shopAreaName(shop, areas)} ・ 07.11</em>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="escomi-home-trust-v2 hl-fade-in" aria-labelledby="home-trust-title">
        <div className="escomi-home-container-v2 escomi-home-trust-v2__grid">
          <div>
            <div className="escomi-home-section-head-v2">
              <h2 id="home-trust-title">情報の出自を分けて掲載しています</h2>
              <p>関西メンズエステ口コミナビでは、次の5種類を混在させずにラベルで区別します。</p>
            </div>
            <div className="escomi-source-list-v2">
              {INFORMATION_LABELS.map((item) => (
                <div className="escomi-source-row-v2" key={item.label}>
                  <span className={`escomi-source-row-v2__badge escomi-source-row-v2__badge--${item.tone}`}>{item.label}</span>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="escomi-beginner-panel-v2" aria-labelledby="home-beginner-title">
            <h2 id="home-beginner-title">初めての方へ</h2>
            <ol>
              <li><span>1</span><strong>地域を選ぶ</strong><p>都道府県 → 詳細エリアの順に絞り込み</p></li>
              <li><span>2</span><strong>条件で比較する</strong><p>料金・営業時間・口コミの有無で絞り込み</p></li>
              <li><span>3</span><strong>店舗詳細・公式情報を確認</strong><p>最新の料金・予約は公式サイトで確認</p></li>
            </ol>
            <div className="escomi-owner-cta-v2">
              <div>
                <strong>店舗オーナー様へ</strong>
                <p>掲載・情報修正・PR掲載のご相談を受け付けています。</p>
              </div>
              <Link href="/contact/">掲載について →</Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
