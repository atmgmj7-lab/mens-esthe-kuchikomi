import "server-only";

import type {
  PublishedReview,
  PublishedReviewMetrics,
  ReviewRepository,
} from "@/lib/reviews/repository";
import { reviewNativeRepository } from "@/lib/supabase/review-native";
import {
  getApprovedReviewsPage,
  getApprovedShopReviews,
} from "@/lib/wp/reviews";
import { getAllShopsForListing } from "@/lib/wp/shops";
import type { ShopView } from "@/lib/wp/types";

export type ReviewReadSource = "wordpress" | "supabase";
export type PublicReviewId = number | string;

export type PublicReview = Readonly<{
  id: PublicReviewId;
  body: string;
  submittedAt: string | null;
  ratings: Readonly<{
    total: number | null;
    price: number | null;
    service: number | null;
    cleanliness: number | null;
  }>;
}>;

export type PublicReviewMetric = Readonly<{
  average: number | null;
  responseCount: number;
}>;

export type PublicShopReviewPage = Readonly<{
  reviews: readonly PublicReview[];
  total: number;
  totalPages: number;
  page: number;
  metrics: Readonly<Record<"total" | "price" | "service" | "cleanliness", PublicReviewMetric>>;
  dateRange: Readonly<{
    oldestSubmittedAt: string;
    latestSubmittedAt: string;
  }> | null;
}>;

export type PublicShopReviewResult =
  | Readonly<{ status: "available"; source: ReviewReadSource; page: PublicShopReviewPage }>
  | Readonly<{
      status: "unavailable";
      source: ReviewReadSource;
      reason: "request-failed" | "invalid-response";
    }>;

export type PublicReviewArea = Readonly<{ id: number; slug: string; name: string }>;
export type PublicGlobalReview = PublicReview & Readonly<{
  shop: Readonly<{
    id: number;
    slug: string;
    name: string;
    primaryArea: PublicReviewArea | null;
  }>;
  areas: readonly PublicReviewArea[];
}>;

export type PublicGlobalReviewResult =
  | Readonly<{
      status: "available";
      source: ReviewReadSource;
      page: Readonly<{
        reviews: readonly PublicGlobalReview[];
        total: number;
        totalPages: number;
        page: number;
      }>;
    }>
  | Readonly<{
      status: "unavailable";
      source: ReviewReadSource;
      reason: "request-failed" | "invalid-response";
    }>;

type Environment = Readonly<Record<string, string | undefined>>;

type PublicReviewAdapterDependencies = Readonly<{
  repository: Pick<ReviewRepository, "listPublished" | "getPublishedMetrics">;
  readWordPressShopReviews: typeof getApprovedShopReviews;
  readWordPressGlobalReviews: typeof getApprovedReviewsPage;
  listWordPressShops: typeof getAllShopsForListing;
  environment: Environment;
}>;

export type PublicReviewAdapter = Readonly<{
  source: ReviewReadSource;
  getShopReviews(shop: ShopView, page?: number, perPage?: number): Promise<PublicShopReviewResult>;
  getGlobalReviews(
    page?: number,
    perPage?: number,
    primaryAreaSlug?: string | null,
  ): Promise<PublicGlobalReviewResult>;
}>;

export function publicShopReviewRobots(
  result: PublicShopReviewResult,
  requestedPage: number,
): { index: boolean; follow: true } {
  const index = result.status === "available"
    && result.page.total > 0
    && requestedPage >= 1
    && requestedPage <= result.page.totalPages
    && result.page.reviews.length > 0;
  return { index, follow: true };
}

const MAX_PAGE = 1000;
const MAX_PER_PAGE = 20;
const CANONICAL_AREA_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolveReviewReadSource(environment: Environment): ReviewReadSource {
  return environment.REVIEW_READ_SOURCE === "supabase" ? "supabase" : "wordpress";
}

function unavailable(
  source: ReviewReadSource,
  reason: "request-failed" | "invalid-response",
): PublicShopReviewResult & PublicGlobalReviewResult {
  return { status: "unavailable", source, reason };
}

function validPageRequest(page: number, perPage: number): boolean {
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE
    && Number.isSafeInteger(perPage) && perPage >= 1 && perPage <= MAX_PER_PAGE
    && page - 1 <= Math.floor(Number.MAX_SAFE_INTEGER / perPage);
}

function isCurrentPublicShop(shop: ShopView): boolean {
  return Number.isSafeInteger(shop.id) && shop.id > 0
    && shop.publicationStatus === "publish"
    && typeof shop.slug === "string" && shop.slug.trim() === shop.slug
    && shop.slug.length > 0 && shop.slug.length <= 200 && !/[/?#\s]/u.test(shop.slug)
    && typeof shop.title === "string" && shop.title.trim() === shop.title && shop.title.length > 0;
}

function publicAreas(shop: ShopView): PublicReviewArea[] | null {
  const areas: PublicReviewArea[] = [];
  const ids = new Set<number>();
  const slugs = new Set<string>();
  for (const term of shop.terms.filter((item) => item.taxonomy === "area")) {
    if (!Number.isSafeInteger(term.id) || term.id <= 0
      || !CANONICAL_AREA_SLUG_RE.test(term.slug)
      || typeof term.name !== "string" || !term.name.trim()
      || ids.has(term.id) || slugs.has(term.slug)) return null;
    ids.add(term.id);
    slugs.add(term.slug);
    areas.push({ id: term.id, slug: term.slug, name: term.name });
  }
  return areas;
}

function currentShopIdentity(shop: ShopView): {
  shop: PublicGlobalReview["shop"];
  areas: readonly PublicReviewArea[];
} | null {
  if (!isCurrentPublicShop(shop)) return null;
  const areas = publicAreas(shop);
  if (!areas) return null;
  const primaryArea = shop.primaryArea === null
    ? null
    : areas.find((area) => area.id === shop.primaryArea?.id
      && area.slug === shop.primaryArea.slug
      && area.name === shop.primaryArea.name) ?? null;
  if (shop.primaryArea !== null && primaryArea === null) return null;
  return {
    shop: { id: shop.id, slug: shop.slug, name: shop.title, primaryArea },
    areas,
  };
}

function toPublicReview(review: PublishedReview): PublicReview {
  return {
    id: review.reviewId,
    body: review.body,
    submittedAt: review.submittedAt,
    ratings: {
      total: review.rating,
      price: review.ratingPrice,
      service: review.ratingService,
      cleanliness: review.ratingCleanliness,
    },
  };
}

function expectedPageSize(total: number, page: number, perPage: number): number {
  const offset = (page - 1) * perPage;
  return Math.max(0, Math.min(perPage, total - offset));
}

function toMetrics(metrics: PublishedReviewMetrics): PublicShopReviewPage["metrics"] {
  return {
    total: metrics.overall,
    price: metrics.price,
    service: metrics.service,
    cleanliness: metrics.cleanliness,
  };
}

async function readNative(
  repository: PublicReviewAdapterDependencies["repository"],
  wpShopIds: readonly number[],
  page: number,
  perPage: number,
): Promise<
  | Readonly<{ ok: true; reviews: readonly PublishedReview[]; metrics: PublishedReviewMetrics }>
  | Readonly<{ ok: false; reason: "request-failed" | "invalid-response" }>
> {
  const offset = (page - 1) * perPage;
  const [reviews, metrics] = await Promise.all([
    repository.listPublished({ shop: null, wpShopIds, limit: perPage, offset }),
    repository.getPublishedMetrics({ shop: null, wpShopIds }),
  ]);
  if (reviews.status === "error") {
    return {
      ok: false,
      reason: reviews.error.code === "request_failed" || reviews.error.code === "not_configured"
        ? "request-failed"
        : "invalid-response",
    };
  }
  if (metrics.status === "error") {
    return {
      ok: false,
      reason: metrics.error.code === "request_failed" || metrics.error.code === "not_configured"
        ? "request-failed"
        : "invalid-response",
    };
  }
  if (metrics.status !== "ok") return { ok: false, reason: "invalid-response" };
  const rows = reviews.status === "ok" ? reviews.data : [];
  if (rows.length !== expectedPageSize(metrics.data.reviewCount, page, perPage)) {
    return { ok: false, reason: "invalid-response" };
  }
  return { ok: true, reviews: rows, metrics: metrics.data };
}

export function createPublicReviewAdapter(
  dependencies: PublicReviewAdapterDependencies,
): PublicReviewAdapter {
  const source = resolveReviewReadSource(dependencies.environment);
  return {
    source,

    async getShopReviews(shop, page = 1, perPage = 20) {
      if (!validPageRequest(page, perPage)) return unavailable(source, "invalid-response");
      if (source === "wordpress") {
        const result = await dependencies.readWordPressShopReviews(shop.id, page, perPage);
        return result.status === "available"
          ? { ...result, source }
          : { ...result, source };
      }
      if (!isCurrentPublicShop(shop)) return unavailable(source, "invalid-response");
      const native = await readNative(dependencies.repository, [shop.id], page, perPage);
      if (!native.ok) return unavailable(source, native.reason);
      if (native.reviews.some((review) => review.shop.wpShopId !== shop.id)) {
        return unavailable(source, "invalid-response");
      }
      const total = native.metrics.reviewCount;
      return {
        status: "available",
        source,
        page: {
          reviews: native.reviews.map(toPublicReview),
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / perPage),
          page,
          metrics: toMetrics(native.metrics),
          dateRange: native.metrics.oldestSubmittedAt && native.metrics.latestSubmittedAt
            ? {
                oldestSubmittedAt: native.metrics.oldestSubmittedAt,
                latestSubmittedAt: native.metrics.latestSubmittedAt,
              }
            : null,
        },
      };
    },

    async getGlobalReviews(page = 1, perPage = 20, primaryAreaSlug = null) {
      if (!validPageRequest(page, perPage)
        || (primaryAreaSlug !== null && !CANONICAL_AREA_SLUG_RE.test(primaryAreaSlug))) {
        return unavailable(source, "invalid-response");
      }
      if (source === "wordpress") {
        const result = await dependencies.readWordPressGlobalReviews(page, perPage, primaryAreaSlug);
        return result.status === "available"
          ? { ...result, source }
          : { ...result, source };
      }

      let shops: ShopView[];
      try {
        shops = await dependencies.listWordPressShops(500);
      } catch {
        return unavailable(source, "request-failed");
      }
      const identities = new Map<number, NonNullable<ReturnType<typeof currentShopIdentity>>>();
      for (const shop of shops) {
        if (!isCurrentPublicShop(shop)) continue;
        const identity = currentShopIdentity(shop);
        if (!identity || identities.has(shop.id)) return unavailable(source, "invalid-response");
        if (primaryAreaSlug === null || identity.shop.primaryArea?.slug === primaryAreaSlug) {
          identities.set(shop.id, identity);
        }
      }
      const wpShopIds = [...identities.keys()].sort((left, right) => left - right);
      const native = await readNative(dependencies.repository, wpShopIds, page, perPage);
      if (!native.ok) return unavailable(source, native.reason);
      const reviews: PublicGlobalReview[] = [];
      for (const review of native.reviews) {
        const identity = identities.get(review.shop.wpShopId);
        if (!identity) return unavailable(source, "invalid-response");
        reviews.push({ ...toPublicReview(review), ...identity });
      }
      const total = native.metrics.reviewCount;
      return {
        status: "available",
        source,
        page: {
          reviews,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / perPage),
          page,
        },
      };
    },
  };
}

export const publicReviewAdapter = createPublicReviewAdapter({
  repository: reviewNativeRepository,
  readWordPressShopReviews: getApprovedShopReviews,
  readWordPressGlobalReviews: getApprovedReviewsPage,
  listWordPressShops: getAllShopsForListing,
  environment: process.env,
});
