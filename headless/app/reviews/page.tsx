import type { Metadata } from "next";
import { Suspense } from "react";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import { ReviewsHub } from "@/components/reviews/ReviewsHub";
import {
  normalizeReviewHubQuery,
  reviewsHubBreadcrumbJsonLd,
  reviewsHubMetadataState,
} from "@/lib/review-hub";
import { canonicalUrl, pageMetadata } from "@/lib/seo";
import { getLatestPosts } from "@/lib/wp/posts";
import { getApprovedReviewsPage } from "@/lib/wp/reviews";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filters = normalizeReviewHubQuery(await searchParams);
  const state = reviewsHubMetadataState(filters);
  return pageMetadata({
    title: "関西メンズエステの口コミ・体験談｜Eskomi",
    description: "関西のメンズエステに寄せられた承認済み口コミ・体験談を、店舗・エリア情報とあわせて確認できます。",
    path: state.canonicalPath,
    robots: state.robots,
  });
}

export default function ReviewsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<RoutePageFallback variant="static" />}>
      <ReviewsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewsPageContent({ searchParams }: Props) {
  const filters = normalizeReviewHubQuery(await searchParams);
  const [reviewResult, postsResult] = await Promise.allSettled([
    getApprovedReviewsPage(filters.page, 20),
    getLatestPosts(6),
  ]);
  const reviews = reviewResult.status === "fulfilled" ? reviewResult.value : {
    status: "unavailable" as const,
    reason: "request-failed" as const,
  };
  const posts = postsResult.status === "fulfilled" ? postsResult.value : [];
  const page = reviews.status === "available" ? reviews.page : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(reviewsHubBreadcrumbJsonLd(canonicalUrl)),
        }}
      />
      <ReviewsHub
        reviews={page?.reviews ?? []}
        total={page?.total ?? 0}
        totalPages={page?.totalPages ?? 0}
        filters={filters}
        posts={posts}
        availability={page ? "available" : "unavailable"}
      />
    </>
  );
}
