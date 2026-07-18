import { cacheLife, cacheTag } from "next/cache";
import { wpFetch } from "@/lib/wp/client";
import type {
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

export function validateApprovedShopReviewPage(value: unknown): ApprovedShopReviewPage | null {
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

  if (
    (value.total === 0 && (value.totalPages !== 0 || value.items.length !== 0 || value.dateRange !== null)) ||
    (value.total > 0 && value.totalPages < 1) ||
    value.items.length > value.total
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
): Promise<ApprovedShopReviewResult> {
  let payload: unknown;
  try {
    payload = await request();
  } catch {
    return { status: "unavailable", reason: "request-failed" };
  }

  const page = validateApprovedShopReviewPage(payload);
  return page
    ? { status: "available", page }
    : { status: "unavailable", reason: "invalid-response" };
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

  return resolveApprovedShopReviewRequest(() =>
    wpFetch<unknown>(
      `/escomi/v1/shops/${shopId}/reviews?page=${page}&per_page=${perPage}`,
    ),
  );
}
