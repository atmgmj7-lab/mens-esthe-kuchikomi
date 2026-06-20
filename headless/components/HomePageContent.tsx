import Link from "next/link";
import { AreaFeatureSection } from "@/components/AreaFeatureSection";
import { KansaiAreaGrid } from "@/components/KansaiAreaGrid";
import { SectionTitle } from "@/components/SectionTitle";
import { ShopCard } from "@/components/ShopCard";
import type { AreaView, BlogPostView, ShopView } from "@/lib/wp/types";

const POPULAR_CHIPS = [
  { label: "日本橋", href: "/area/nihonbashi/" },
  { label: "難波", href: "/area/nanba/" },
  { label: "梅田", href: "/area/umeda/" },
  { label: "深夜営業", href: "/area/nihonbashi/#late-night" },
  { label: "駅近", href: "/area/nihonbashi/#station-near" },
  { label: "料金比較", href: "/area/nihonbashi/#price-table" },
  { label: "口コミ投稿", href: "/reviews/submit/" }
];

const FEATURED_HUBS = [
  {
    slug: "nihonbashi",
    href: "/area/nihonbashi/",
    title: "大阪日本橋メンズエステ",
    lead: "口コミ・料金・営業時間で比較",
    badge: "本命ハブ"
  },
  {
    slug: "nanba",
    href: "/area/nanba/",
    title: "大阪難波メンズエステ",
    lead: "なんば周辺の候補を整理",
    badge: "人気エリア"
  },
  {
    slug: "umeda",
    href: "/area/umeda/",
    title: "大阪梅田メンズエステ",
    lead: "梅田・大阪駅周辺で探す",
    badge: "注目エリア"
  }
];

function areaCount(areas: AreaView[], slug: string): number | null {
  const area = areas.find((item) => item.slug === slug);
  return area?.count ?? null;
}

function shopText(shop: ShopView): string {
  const acfText = Object.values(shop.acf ?? {})
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ");
  return [shop.title, shop.excerpt, shop.areaSlug, ...shop.terms.map((term) => `${term.name} ${term.slug}`), acfText]
    .join(" ")
    .toLowerCase();
}

function pickNihonbashiShops(shops: ShopView[]): ShopView[] {
  const nihonbashiShops = shops.filter((shop) => /日本橋|nihonbashi|近鉄日本橋|黒門|なんば|難波/.test(shopText(shop)));
  const selected = nihonbashiShops.length > 0 ? nihonbashiShops : shops;
  const unique = new Map<number, ShopView>();
  selected.forEach((shop) => unique.set(shop.id, shop));
  return Array.from(unique.values()).slice(0, 5);
}

function shopAreaLabel(shop: ShopView): string {
  const areaTerm = shop.terms.find((term) => term.parent !== 0) || shop.terms[0];
  return areaTerm?.name || "エリア確認中";
}

export function HomePageContent({
  shopCount,
  shops,
  areas,
  posts
}: {
  shopCount: number;
  shops: ShopView[];
  areas: AreaView[];
  posts: BlogPostView[];
}) {
  const displayPosts = posts.filter(
    (post) => post.title.trim().toLowerCase() !== "hello world!"
  );
  const hasColumnPost = displayPosts.length > 0;
  const nihonbashiShops = pickNihonbashiShops(shops);

  return (
    <main id="main_content" className="l-mainContent">
      <div className="mep-homeNightLux">
        <section className="mep-hero-estama mep-hero-nightlux hl-fade-in">
          <div className="mep-container">
            <div className="mep-hero-glass">
              <div className="mep-hero-flex">
                <div className="mep-hero-left">
                  <p className="mep-hero-sub">関西メンズエステの口コミ情報サイト【エスコミ】</p>
                  <h1 className="mep-hero-title">関西メンズエステ口コミナビ エスコミ</h1>
                  <div className="mep-hero-logo-mark" aria-hidden="true">
                    <img
                      src="/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png"
                      alt=""
                      width={400}
                      height={120}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </div>
                  <p className="mep-hero-lead">
                    大阪日本橋・難波・梅田を中心に、店舗一覧・料金・営業時間・編集部コメントで比較できます。
                  </p>
                  <form className="mep-home-search" action="/shops/" method="get" role="search">
                    <label className="sr-only" htmlFor="home-shop-search">
                      エリア名または店舗名で探す
                    </label>
                    <input
                      id="home-shop-search"
                      className="mep-home-search__input"
                      type="search"
                      name="q"
                      placeholder="日本橋・難波・梅田・店舗名を入力"
                      autoComplete="off"
                    />
                    <button className="mep-home-search__button" type="submit">
                      探す
                    </button>
                  </form>
                  <nav className="mep-home-chips" aria-label="人気条件">
                    {POPULAR_CHIPS.map((chip) => (
                      <Link className="mep-home-chip" href={chip.href} key={chip.href}>
                        {chip.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mep-hero-count-box">
                    <span className="label">現在の掲載店舗数</span>
                    <span className="number">{shopCount || shops.length}</span>
                    <span className="unit">店</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mep-home-ad-section" aria-label="広告">
          <div className="mep-container">
            <div className="mep-home-ad-slot">
              <span>
                広告掲載枠
                <br />
                （レスポンシブ）
              </span>
            </div>
          </div>
        </section>

        <section className="mep-home-hub-section hl-fade-in">
          <div className="mep-container">
            <SectionTitle jp="注目エリアハブ" center />
            <div className="mep-home-hub-grid">
              {FEATURED_HUBS.map((hub) => {
                const count = areaCount(areas, hub.slug);
                return (
                  <Link className="mep-home-hub-card hl-card-hover" href={hub.href} key={hub.slug}>
                    <span className="mep-home-hub-card__badge">{hub.badge}</span>
                    <h3 className="mep-home-hub-card__title">{hub.title}</h3>
                    <p className="mep-home-hub-card__lead">{hub.lead}</p>
                    <span className="mep-home-hub-card__meta">
                      {count ? `${count}件を比較` : "店舗一覧を見る"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {nihonbashiShops.length > 0 ? (
          <section className="mep-home-mini-section hl-fade-in">
            <div className="mep-container">
              <SectionTitle jp="日本橋の注目店舗" center />
              <div className="mep-home-mini-list">
                {nihonbashiShops.map((shop) => (
                  <article className="mep-home-mini-card" key={shop.id}>
                    <span className="mep-home-mini-card__area">{shopAreaLabel(shop)}</span>
                    <h3 className="mep-home-mini-card__title">
                      <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
                    </h3>
                    <div className="mep-home-mini-card__actions">
                      <Link href={`/shops/${shop.slug}/`}>店舗詳細</Link>
                      <Link href="/area/nihonbashi/">日本橋で比較</Link>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mep-center">
                <Link href="/area/nihonbashi/" className="mep-cta-btn mep-cta-btn--outline">
                  大阪日本橋メンズエステ一覧を見る
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <AreaFeatureSection />
        <KansaiAreaGrid areas={areas} />

        <section className="mep-white-section hl-fade-in">
          <div className="mep-container">
            <SectionTitle jp="新着店舗" center />
            <div className="mep-feature-cards hl-new-shops-grid">
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} variant="new" />
              ))}
            </div>
            <div className="mep-center">
              <Link href="/shops/" className="mep-cta-btn mep-cta-btn--outline">
                新着店舗をもっと見る
              </Link>
            </div>
          </div>
        </section>

        <section className="mep-blog-section hl-fade-in">
          <div className="mep-container">
            <SectionTitle jp="新着コラム・体験レポート" center />
            <div className="mep-blog-list">
              {hasColumnPost ? (
                displayPosts.slice(0, 1).map((post) => (
                  <article className="mep-blog-entry" key={post.id}>
                    <time className="mep-blog-entry__date">
                      {new Date(post.date).toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        weekday: "short"
                      })}
                    </time>
                    {post.terms[0] ? (
                      <span className="mep-blog-entry__cat">{post.terms[0].name}</span>
                    ) : (
                      <span className="mep-blog-entry__cat">未分類</span>
                    )}
                    <h3 className="mep-blog-entry__title">
                      <Link href={`/column/${post.slug}/`}>{post.title}</Link>
                    </h3>
                    {post.excerpt ? <p className="mep-blog-entry__excerpt">{post.excerpt}</p> : null}
                  </article>
                ))
              ) : (
                <article className="mep-blog-entry">
                  <span className="mep-blog-entry__cat">ガイド</span>
                  <h3 className="mep-blog-entry__title">
                    <Link href="/osaka-nihonbashi/">
                      日本橋メンズエステで失敗しない選び方｜料金・口コミ・営業時間の見方
                    </Link>
                  </h3>
                  <p className="mep-blog-entry__excerpt">
                    初めて日本橋エリアのメンズエステを利用する方向けに、料金・口コミ・営業時間の確認ポイントをまとめました。
                  </p>
                </article>
              )}
            </div>
            <div className="mep-center">
              <Link href="/column/" className="mep-cta-btn mep-cta-btn--solid">
                コラム一覧を見る
              </Link>
            </div>
          </div>
        </section>

        <section className="mep-about-section hl-fade-in">
          <div className="mep-container mep-about-container">
            <h2 className="mep-about-title">関西メンズエステ口コミ（エスコミ）について</h2>
            <p className="mep-about-lead">
              当サイトは、大阪・京都・神戸を中心に、関西エリアのメンズエステ情報を厳選して掲載しています。
              <br />
              公開情報・店舗データ・投稿口コミ（承認制）・編集部コメントを分けて整理し、比較しやすい店舗探しをサポートします。
            </p>
            <div className="mep-cta-panel">
              <h3 className="mep-cta-title">店舗オーナー様へ</h3>
              <p className="mep-cta-text">
                当サイトへの掲載をご希望の店舗様は、こちらよりお問い合わせください。
              </p>
              <a href="/contact/" className="mep-cta-btn mep-cta-btn--inverse">
                掲載のお問い合わせ
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
