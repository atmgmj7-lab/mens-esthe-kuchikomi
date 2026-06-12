import Link from "next/link";
import { AreaFeatureSection } from "@/components/AreaFeatureSection";
import { KansaiAreaGrid } from "@/components/KansaiAreaGrid";
import { SectionTitle } from "@/components/SectionTitle";
import { ShopCard } from "@/components/ShopCard";
import type { AreaView, BlogPostView, ShopView } from "@/lib/wp/types";

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
  return (
    <main id="main_content" className="l-mainContent">
      <div className="mep-homeNightLux">
        <section className="mep-hero-estama mep-hero-nightlux hl-fade-in">
          <div className="mep-container">
            <div className="mep-hero-glass">
              <div className="mep-hero-flex">
                <div className="mep-hero-left">
                  <p className="mep-hero-sub">関西メンズエステの口コミ情報サイト【エスコミ】</p>
                  <h1 className="mep-hero-logo">
                    <img
                      src="/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png"
                      alt="Escomi（エスコミ）| 関西メンズエステ口コミナビ"
                      width={400}
                      height={120}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </h1>
                  <div className="mep-hero-count-box">
                    <span className="label">現在の掲載店舗数</span>
                    <span className="number">{shopCount || shops.length}</span>
                    <span className="unit">店</span>
                  </div>
                </div>
                <div className="mep-hero-right">
                  <div className="mep-hero-ad-slot">
                    <span>
                      広告掲載枠
                      <br />
                      （300×250）
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
              {posts.slice(0, 1).map((post) => (
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
              ))}
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
              実際の利用者によるリアルな情報と、詳細な店舗データであなたにぴったりのサロン探しをサポートします。
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
