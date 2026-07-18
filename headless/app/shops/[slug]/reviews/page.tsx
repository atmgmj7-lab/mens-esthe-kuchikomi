import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import styles from "@/components/shop-detail/ShopDetail.module.css";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import { canonicalUrl, pageMetadata } from "@/lib/seo";
import { toShopRouteParam } from "@/lib/shop-route-param";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { getApprovedShopReviews } from "@/lib/wp/reviews";
import { getShopBySlug, getShopsForSitemap } from "@/lib/wp/shops";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateStaticParams() {
  return getStaticParamsOrFallback(
    "shop review static params",
    getShopsForSitemap,
    (shop) => ({ slug: toShopRouteParam(shop.slug) }),
    [{ slug: "__wp-build-fallback__" }]
  );
}

function parseReviewPage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function reviewPagePath(slug: string, page: number): string {
  const base = `/shops/${slug}/reviews/`;
  return page > 1 ? `${base}?page=${page}` : base;
}

function formatReviewDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo"
  }).format(new Date(value));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parseReviewPage(query.page);
  if (page === null) return {};
  const shop = await withWpBuildFallback(
    `shop review metadata ${slug}`,
    () => getShopBySlug(slug),
    null
  );
  if (!shop) return {};
  const path = reviewPagePath(shop.slug, page);

  const metadata = pageMetadata({
    title: `${shop.title}の承認済み口コミ${page > 1 ? `（${page}ページ目）` : ""}`,
    description: `${shop.title}に投稿され、運営確認後に承認されたユーザー口コミを掲載しています。`,
    path,
    canonicalOverride: canonicalUrl(path)
  });
  return { ...metadata, alternates: { canonical: canonicalUrl(path) } };
}

export default function ShopReviewsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<RoutePageFallback variant="static" />}>
      <ShopReviewsPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopReviewsPageContent({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parseReviewPage(query.page);
  if (page === null) notFound();

  const shop = await withWpBuildFallback(
    `shop reviews ${slug}`,
    () => getShopBySlug(slug),
    null
  );
  if (!shop) notFound();

  const reviewResult = await getApprovedShopReviews(shop.id, page, 20);
  if (
    reviewResult.status === "available" &&
    page > Math.max(1, reviewResult.page.totalPages)
  ) {
    notFound();
  }

  const submitUrl = buildReviewSubmitUrl(shop.slug);
  const reviews = reviewResult.status === "available" ? reviewResult.page.reviews : [];
  const totalPages = reviewResult.status === "available" ? reviewResult.page.totalPages : 0;

  return (
    <main id="main_content" className={`l-mainContent hl-shop-page ${styles.page}`}>
      <div className={styles.shell}>
        <nav className="shop-breadcrumb area-breadcrumb" aria-label="パンくず">
          <Link href="/">ホーム</Link> &gt; <Link href="/shops/">店舗情報</Link> &gt;{" "}
          <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link> &gt; <span>口コミ</span>
        </nav>

        <article className={styles.detailContent}>
          <section className={styles.section} aria-labelledby="shop-review-list-heading">
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>USER REVIEWS</p>
              <h1 id="shop-review-list-heading">{shop.title}の承認済み口コミ</h1>
            </div>

            {reviewResult.status === "unavailable" ? (
              <p role="status">口コミ情報を現在取得できません。時間をおいて再度ご確認ください。</p>
            ) : reviews.length === 0 ? (
              <div>
                <p>この店舗の承認済みユーザー口コミはまだありません。</p>
                <Link href={submitUrl} className={styles.textLink}>
                  この店舗の口コミを投稿する
                </Link>
              </div>
            ) : (
              <div className={styles.reviews}>
                {reviews.map((review) => (
                  <article key={review.id}>
                    <p>{review.body}</p>
                    {review.submittedAt ? (
                      <small>
                        投稿日{" "}
                        <time dateTime={review.submittedAt}>{formatReviewDate(review.submittedAt)}</time>
                      </small>
                    ) : null}
                  </article>
                ))}
                <p className={styles.sourceNote}>
                  掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません。
                </p>
                <Link href={submitUrl} className={styles.textLink}>
                  この店舗の口コミを投稿する
                </Link>
              </div>
            )}
          </section>

          {reviewResult.status === "available" && totalPages > 1 ? (
            <nav className={styles.actions} aria-label="口コミページ送り">
              {page > 1 ? (
                <Link href={reviewPagePath(shop.slug, page - 1)} rel="prev" className={styles.secondaryAction}>
                  前のページ
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link href={reviewPagePath(shop.slug, page + 1)} rel="next" className={styles.secondaryAction}>
                  次のページ
                </Link>
              ) : null}
            </nav>
          ) : null}
        </article>
      </div>
    </main>
  );
}
