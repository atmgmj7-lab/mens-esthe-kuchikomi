import Link from "next/link";
import { PriorityAreaLinks } from "@/components/reviews/PriorityAreaLinks";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import {
  buildReviewHubPageUrl,
  filterReviewsForHub,
  type ReviewHubQuery,
} from "@/lib/review-hub";
import type { ApprovedGlobalReview } from "@/lib/wp/types";
import styles from "./ReviewsHub.module.css";

type EditorialLink = Readonly<{
  id: number;
  slug: string;
  title: string;
  date: string;
  excerpt: string;
}>;

export function ReviewsHub({
  reviews,
  total,
  totalPages,
  filters,
  posts,
  availability = "available",
}: {
  reviews: readonly ApprovedGlobalReview[];
  total: number;
  totalPages: number;
  filters: ReviewHubQuery;
  posts: readonly EditorialLink[];
  availability?: "available" | "unavailable";
}) {
  const filteredReviews = availability === "available" ? filterReviewsForHub(reviews, filters) : [];
  const areaOptions = new Map<string, string>();
  for (const review of reviews) {
    for (const area of review.areas) areaOptions.set(area.slug, area.name);
  }

  return (
    <main id="main_content" className={styles.page} data-reviews-hub="true">
      <nav className={styles.breadcrumb} aria-label="パンくずリスト">
        <Link href="/">TOP</Link><span aria-hidden="true">/</span><span aria-current="page">口コミ・体験</span>
      </nav>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>REVIEWS &amp; EXPERIENCE</p>
        <h1>関西メンズエステの口コミ・体験談</h1>
        <p>公開店舗に紐づく承認済みユーザー口コミを、店舗・エリアへの導線と一緒に確認できます。</p>
        <Link className={styles.primaryCta} href="/reviews/submit/">口コミを書く</Link>
      </header>

      <section className={styles.filterSection} aria-labelledby="reviews-filter-heading">
        <div>
          <p className={styles.eyebrow}>SEARCH THE LATEST</p>
          <h2 id="reviews-filter-heading">最新口コミを絞り込む</h2>
          <p>このページに表示中の最新口コミを、店舗名・地域名・本文から絞り込みます。</p>
        </div>
        <form className={styles.filterForm} action="/reviews/" method="get" role="search">
          <label>
            キーワード
            <input type="search" name="q" defaultValue={filters.q} maxLength={80} placeholder="店舗名・地域名・口コミ本文" />
          </label>
          <label>
            エリア
            <select name="area" defaultValue={filters.area}>
              <option value="">すべてのエリア</option>
              {[...areaOptions].map(([slug, name]) => <option value={slug} key={slug}>{name}</option>)}
            </select>
          </label>
          <button type="submit">絞り込む</button>
          {filters.hasQuery ? <Link href="/reviews/">条件を解除</Link> : null}
        </form>
      </section>

      <section className={styles.reviewsSection} aria-labelledby="latest-approved-reviews-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>APPROVED USER REVIEWS</p>
            <h2 id="latest-approved-reviews-heading">新着口コミ・体験</h2>
            <p>承認済みユーザー口コミのみを掲載しています。編集部記事や店舗提供情報は集計へ含めません。</p>
          </div>
          {availability === "available" ? <span>{filters.hasQuery ? `${filteredReviews.length}件表示` : `全${total}件`}</span> : null}
        </div>
        {filteredReviews.length > 0 ? (
          <div className={styles.reviewGrid}>
            {filteredReviews.map((review) => <ReviewCard review={review} key={review.id} />)}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>{availability === "unavailable" ? "口コミ情報を現在取得できません" : filters.hasQuery ? "条件に一致する口コミはありません" : "現在表示できる承認済み口コミはありません"}</strong>
            <p>{availability === "unavailable" ? "時間をおいて再度ご確認ください。" : "条件を変えるか、店舗一覧から口コミ投稿先を探してください。"}</p>
            <div><Link href="/reviews/">最新口コミへ戻る</Link><Link href="/shops/">店舗を探す</Link></div>
          </div>
        )}
        {totalPages > 1 ? (
          <nav className={styles.pagination} aria-label="口コミ一覧のページ送り">
            {filters.page > 1 ? <Link href={buildReviewHubPageUrl(filters.page - 1, filters)}>前のページ</Link> : <span />}
            <span>{filters.page} / {totalPages}</span>
            {filters.page < totalPages ? <Link href={buildReviewHubPageUrl(filters.page + 1, filters)}>次のページ</Link> : <span />}
          </nav>
        ) : null}
      </section>

      <section className={styles.shopDiscovery} aria-labelledby="review-shop-discovery-heading">
        <div>
          <p className={styles.eyebrow}>SHOP DISCOVERY</p>
          <h2 id="review-shop-discovery-heading">口コミから店舗情報へ</h2>
          <p>各口コミの店舗名から、料金・営業時間・アクセスなどの公開店舗情報を確認できます。</p>
        </div>
        <Link href="/shops/">関西のメンズエステ店舗を探す</Link>
      </section>

      {posts.length > 0 ? (
        <section className={styles.editorialSection} aria-labelledby="editorial-experience-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>EDITORIAL</p>
              <h2 id="editorial-experience-heading">編集部コラム</h2>
              <p>ユーザー口コミとは分けて、固有URLと本文を持つ公開済み記事だけを紹介します。</p>
            </div>
            <Link href="/column/">コラム一覧を見る</Link>
          </div>
          <div className={styles.editorialGrid}>
            {posts.map((post) => (
              <article key={post.id}>
                <time dateTime={post.date}>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).format(new Date(post.date))}</time>
                <h3><Link href={`/column/${post.slug}/`}>{post.title}</Link></h3>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <PriorityAreaLinks heading="口コミと店舗を探せる重点エリア" compact />
    </main>
  );
}
