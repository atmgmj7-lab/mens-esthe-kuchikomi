import { cacheLife, cacheTag } from "next/cache";
import { wpFetch } from "@/lib/wp/client";
import type {
  ApprovedGlobalReview,
  ApprovedGlobalReviewArea,
  ApprovedGlobalReviewPage,
  ApprovedGlobalReviewResult,
  ApprovedShopReview,
  ApprovedShopReviewMetric,
  ApprovedShopReviewPage,
  ApprovedShopReviewResult,
} from "@/lib/wp/types";

type PublicReviewPayload = {
  id: number;
  body: string;
  submittedAt: string | null;
  ratingTotal: number | null;
  ratingPrice: number | null;
  ratingService: number | null;
  ratingCleanliness: number | null;
};

type PublicGlobalReviewPayload = PublicReviewPayload & {
  shop: {
    id: number;
    slug: string;
    name: string;
  };
  areas: Array<{
    id: number;
    slug: string;
    name: string;
  }>;
};

declare const approvedShopReviewSource: unique symbol;

export type ApprovedShopReviewSource = Readonly<{
  shopId: number;
  result: ApprovedShopReviewResult;
  [approvedShopReviewSource]: true;
}>;

const approvedShopReviewSources = new WeakSet<object>();

declare const approvedGlobalReviewSource: unique symbol;

export type ApprovedGlobalReviewSource = Readonly<{
  result: ApprovedGlobalReviewResult;
  [approvedGlobalReviewSource]: true;
}>;

const approvedGlobalReviewSources = new WeakSet<object>();
const GLOBAL_REVIEW_MAX_PAGE = 1000;

const METRIC_KEYS = ["total", "price", "service", "cleanliness"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const lastDay = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;

  return (
    day >= 1 &&
    day <= lastDay &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function isRating(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 5);
}

function isCanonicalSlug(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && !/[/?#\s]/u.test(value);
}

function isPublicName(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function validateMetric(value: unknown, total: number): ApprovedShopReviewMetric | null {
  if (!isRecord(value) || !hasExactKeys(value, ["average", "responseCount"])) return null;
  if (!isNonNegativeInteger(value.responseCount) || value.responseCount > total) return null;

  if (value.responseCount === 0) {
    return value.average === null ? { average: null, responseCount: 0 } : null;
  }

  if (
    typeof value.average !== "number" ||
    !Number.isFinite(value.average) ||
    value.average < 1 ||
    value.average > 5 ||
    Math.abs(value.average * 10 - Math.round(value.average * 10)) > Number.EPSILON
  ) {
    return null;
  }

  return { average: value.average, responseCount: value.responseCount };
}

function validateReview(value: unknown): ApprovedShopReview | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "body",
      "submittedAt",
      "ratingTotal",
      "ratingPrice",
      "ratingService",
      "ratingCleanliness",
    ]) ||
    !isPositiveInteger(value.id) ||
    typeof value.body !== "string" ||
    (value.submittedAt !== null && !isIsoDate(value.submittedAt)) ||
    !isRating(value.ratingTotal) ||
    !isRating(value.ratingPrice) ||
    !isRating(value.ratingService) ||
    !isRating(value.ratingCleanliness)
  ) {
    return null;
  }

  const review = value as PublicReviewPayload;
  return {
    id: review.id,
    body: review.body,
    submittedAt: review.submittedAt,
    ratings: {
      total: review.ratingTotal,
      price: review.ratingPrice,
      service: review.ratingService,
      cleanliness: review.ratingCleanliness,
    },
  };
}

function validateGlobalArea(value: unknown): ApprovedGlobalReviewArea | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["id", "slug", "name"]) ||
    !isPositiveInteger(value.id) ||
    !isCanonicalSlug(value.slug) ||
    !isPublicName(value.name)
  ) {
    return null;
  }
  return { id: value.id, slug: value.slug, name: value.name };
}

function validateGlobalReview(value: unknown): ApprovedGlobalReview | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "body",
      "submittedAt",
      "ratingTotal",
      "ratingPrice",
      "ratingService",
      "ratingCleanliness",
      "shop",
      "areas",
    ]) ||
    !isRecord(value.shop) ||
    !hasExactKeys(value.shop, ["id", "slug", "name"]) ||
    !isPositiveInteger(value.shop.id) ||
    !isCanonicalSlug(value.shop.slug) ||
    !isPublicName(value.shop.name) ||
    !Array.isArray(value.areas)
  ) {
    return null;
  }

  const review = validateReview({
    id: value.id,
    body: value.body,
    submittedAt: value.submittedAt,
    ratingTotal: value.ratingTotal,
    ratingPrice: value.ratingPrice,
    ratingService: value.ratingService,
    ratingCleanliness: value.ratingCleanliness,
  });
  if (!review) return null;

  const areas: ApprovedGlobalReviewArea[] = [];
  const areaIds = new Set<number>();
  const areaSlugs = new Set<string>();
  for (const item of value.areas) {
    const area = validateGlobalArea(item);
    if (!area || areaIds.has(area.id) || areaSlugs.has(area.slug)) return null;
    areaIds.add(area.id);
    areaSlugs.add(area.slug);
    areas.push(area);
  }

  const payload = value as PublicGlobalReviewPayload;
  return {
    ...review,
    shop: {
      id: payload.shop.id,
      slug: payload.shop.slug,
      name: payload.shop.name,
    },
    areas,
  };
}

export function validateApprovedGlobalReviewPage(
  value: unknown,
  expectedPage: number,
  perPage: number,
): ApprovedGlobalReviewPage | null {
  if (
    !isPositiveInteger(expectedPage) ||
    expectedPage > GLOBAL_REVIEW_MAX_PAGE ||
    !isPositiveInteger(perPage) ||
    perPage > 20 ||
    expectedPage - 1 > Math.floor(Number.MAX_SAFE_INTEGER / perPage) ||
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "total", "totalPages", "page"]) ||
    !Array.isArray(value.items) ||
    !isNonNegativeInteger(value.total) ||
    !isNonNegativeInteger(value.totalPages) ||
    !isPositiveInteger(value.page)
  ) {
    return null;
  }

  const expectedTotalPages = value.total === 0 ? 0 : Math.ceil(value.total / perPage);
  const offset = (expectedPage - 1) * perPage;
  const expectedItemCount = Math.max(0, Math.min(perPage, value.total - offset));
  if (
    value.page !== expectedPage ||
    value.totalPages !== expectedTotalPages ||
    value.items.length !== expectedItemCount
  ) {
    return null;
  }

  const reviews: ApprovedGlobalReview[] = [];
  const reviewIds = new Set<number>();
  for (const item of value.items) {
    const review = validateGlobalReview(item);
    if (!review || reviewIds.has(review.id)) return null;
    reviewIds.add(review.id);
    reviews.push(review);
  }

  return {
    reviews,
    total: value.total,
    totalPages: value.totalPages,
    page: value.page,
  };
}

export async function resolveApprovedGlobalReviewRequest(
  request: () => Promise<unknown>,
  expectedPage: number,
  perPage: number,
): Promise<ApprovedGlobalReviewResult> {
  let payload: unknown;
  try {
    payload = await request();
  } catch {
    return freezeApprovedGlobalReviewResult({ status: "unavailable", reason: "request-failed" });
  }

  const page = validateApprovedGlobalReviewPage(payload, expectedPage, perPage);
  if (!page) return freezeApprovedGlobalReviewResult({ status: "unavailable", reason: "invalid-response" });

  return freezeApprovedGlobalReviewResult({ status: "available", page });
}

export function freezeApprovedGlobalReviewResult(
  result: ApprovedGlobalReviewResult,
): ApprovedGlobalReviewResult {
  if (result.status === "unavailable") {
    return Object.freeze({ ...result });
  }

  const reviews = Object.freeze(result.page.reviews.map((review) => Object.freeze({
    ...review,
    ratings: Object.freeze({ ...review.ratings }),
    shop: Object.freeze({ ...review.shop }),
    areas: Object.freeze(review.areas.map((area) => Object.freeze({ ...area }))),
  })));
  return Object.freeze({
    status: "available",
    page: Object.freeze({
      reviews,
      total: result.page.total,
      totalPages: result.page.totalPages,
      page: result.page.page,
    }),
  });
}

export function validateApprovedShopReviewPage(
  value: unknown,
  expectedPage: number,
  perPage: number,
): ApprovedShopReviewPage | null {
  if (
    !isPositiveInteger(expectedPage) ||
    !isPositiveInteger(perPage) ||
    perPage > 20 ||
    expectedPage - 1 > Math.floor(Number.MAX_SAFE_INTEGER / perPage)
  ) {
    return null;
  }

  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "total", "totalPages", "page", "metrics", "dateRange"]) ||
    !Array.isArray(value.items) ||
    !isNonNegativeInteger(value.total) ||
    !isNonNegativeInteger(value.totalPages) ||
    !isPositiveInteger(value.page) ||
    !isRecord(value.metrics) ||
    !hasExactKeys(value.metrics, METRIC_KEYS)
  ) {
    return null;
  }

  const expectedTotalPages = value.total === 0 ? 0 : Math.ceil(value.total / perPage);
  const offset = (expectedPage - 1) * perPage;
  const expectedItemCount = Math.max(0, Math.min(perPage, value.total - offset));
  if (
    (value.total === 0 && (value.totalPages !== 0 || value.items.length !== 0 || value.dateRange !== null)) ||
    value.page !== expectedPage ||
    value.totalPages !== expectedTotalPages ||
    value.items.length > perPage ||
    value.items.length !== expectedItemCount
  ) {
    return null;
  }

  const reviews: ApprovedShopReview[] = [];
  for (const item of value.items) {
    const review = validateReview(item);
    if (!review) return null;
    reviews.push(review);
  }

  const metrics = {} as ApprovedShopReviewPage["metrics"];
  for (const key of METRIC_KEYS) {
    const metric = validateMetric(value.metrics[key], value.total);
    if (!metric) return null;
    metrics[key] = metric;
  }

  let dateRange: ApprovedShopReviewPage["dateRange"] = null;
  if (value.dateRange !== null) {
    if (
      !isRecord(value.dateRange) ||
      !hasExactKeys(value.dateRange, ["oldestSubmittedAt", "latestSubmittedAt"]) ||
      !isIsoDate(value.dateRange.oldestSubmittedAt) ||
      !isIsoDate(value.dateRange.latestSubmittedAt) ||
      Date.parse(value.dateRange.oldestSubmittedAt) > Date.parse(value.dateRange.latestSubmittedAt)
    ) {
      return null;
    }
    dateRange = {
      oldestSubmittedAt: value.dateRange.oldestSubmittedAt,
      latestSubmittedAt: value.dateRange.latestSubmittedAt,
    };
  }

  return {
    reviews,
    total: value.total,
    totalPages: value.totalPages,
    page: value.page,
    metrics,
    dateRange,
  };
}

export async function resolveApprovedShopReviewRequest(
  request: () => Promise<unknown>,
  expectedPage: number,
  perPage: number,
): Promise<ApprovedShopReviewResult> {
  let payload: unknown;
  try {
    payload = await request();
  } catch {
    return { status: "unavailable", reason: "request-failed" };
  }

  const page = validateApprovedShopReviewPage(payload, expectedPage, perPage);
  return page
    ? { status: "available", page }
    : { status: "unavailable", reason: "invalid-response" };
}

export type ApprovedShopReviewRobots = {
  index: boolean;
  follow: true;
};

export function approvedShopReviewRobots(
  result: ApprovedShopReviewResult,
  requestedPage: number,
): ApprovedShopReviewRobots {
  const index =
    result.status === "available" &&
    result.page.total > 0 &&
    requestedPage >= 1 &&
    requestedPage <= result.page.totalPages &&
    result.page.reviews.length > 0;

  return { index, follow: true };
}

export async function getApprovedShopReviews(
  shopId: number,
  page = 1,
  perPage = 20,
): Promise<ApprovedShopReviewResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", `reviews:${shopId}`);

  if (!isPositiveInteger(shopId) || !isPositiveInteger(page) || !isPositiveInteger(perPage) || perPage > 20) {
    return { status: "unavailable", reason: "invalid-response" };
  }

  return resolveApprovedShopReviewRequest(
    () =>
      wpFetch<unknown>(
        `/escomi/v1/shops/${shopId}/reviews?page=${page}&per_page=${perPage}`,
      ),
    page,
    perPage,
  );
}

async function getApprovedReviewsPageCached(
  page: number,
  perPage: number,
): Promise<ApprovedGlobalReviewResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "reviews:global");

  return resolveApprovedGlobalReviewRequest(
    () => wpFetch<unknown>(`/escomi/v1/reviews?page=${page}&per_page=${perPage}`),
    page,
    perPage,
  );
}

export async function getApprovedReviewsPage(
  page = 1,
  perPage = 20,
): Promise<ApprovedGlobalReviewResult> {
  if (!isPositiveInteger(page) || page > GLOBAL_REVIEW_MAX_PAGE || !isPositiveInteger(perPage) || perPage > 20) {
    return freezeApprovedGlobalReviewResult({ status: "unavailable", reason: "invalid-response" });
  }
  return freezeApprovedGlobalReviewResult(await getApprovedReviewsPageCached(page, perPage));
}

export function isApprovedGlobalReviewSource(
  value: unknown,
): value is ApprovedGlobalReviewSource {
  return typeof value === "object"
    && value !== null
    && approvedGlobalReviewSources.has(value);
}

export async function getApprovedReviewsPageWithSource(
  page = 1,
  perPage = 20,
): Promise<ApprovedGlobalReviewSource | null> {
  if (!isPositiveInteger(page) || page > GLOBAL_REVIEW_MAX_PAGE || !isPositiveInteger(perPage) || perPage > 20) return null;

  const source = Object.freeze({
    result: await getApprovedReviewsPage(page, perPage),
  }) as ApprovedGlobalReviewSource;
  approvedGlobalReviewSources.add(source);
  return source;
}

export function approvedGlobalReviewFromSource(
  source: unknown,
  reviewId: unknown,
  shopId: unknown,
): ApprovedGlobalReview | null {
  if (!isApprovedGlobalReviewSource(source) || !isPositiveInteger(reviewId) || !isPositiveInteger(shopId)) {
    return null;
  }
  if (source.result.status !== "available") return null;
  return source.result.page.reviews.find(
    (review) => review.id === reviewId && review.shop.id === shopId,
  ) ?? null;
}

export function isApprovedShopReviewSource(
  value: unknown,
): value is ApprovedShopReviewSource {
  return typeof value === "object"
    && value !== null
    && approvedShopReviewSources.has(value);
}

export async function getApprovedShopReviewsWithSource(
  shopId: number,
  page = 1,
  perPage = 20,
): Promise<ApprovedShopReviewSource | null> {
  if (!isPositiveInteger(shopId)) return null;

  const source = Object.freeze({
    shopId,
    result: await getApprovedShopReviews(shopId, page, perPage),
  }) as ApprovedShopReviewSource;
  approvedShopReviewSources.add(source);
  return source;
}
