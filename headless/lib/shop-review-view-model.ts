import "server-only";

import type {
  ApprovedShopReview,
  ApprovedShopReviewMetric,
  ApprovedShopReviewResult,
} from "@/lib/wp/types";
import type {
  ReviewRelationContext,
  ReviewRelationView,
} from "@/lib/ux-production-data-boundary";

export type ShopReviewMetric = {
  key: "total" | "price" | "service" | "cleanliness";
  label: string;
  value: number;
  count: number;
};

export type ShopReviewViewModel =
  | { status: "unavailable"; reason: "request-failed" | "invalid-response" }
  | {
      status: "available";
      totalApproved: number;
      showGraph: boolean;
      aggregateRating: number | null;
      aggregateRatingCount: number;
      metrics: ShopReviewMetric[];
      latest: ApprovedShopReview[];
      dateRange: {
        oldestSubmittedAt: string | null;
        latestSubmittedAt: string | null;
      };
    };

const MINIMUM_GRAPH_RESPONSES = 3;

const METRIC_LABELS: Record<ShopReviewMetric["key"], string> = {
  total: "総合評価",
  price: "料金満足度",
  service: "接客満足度",
  cleanliness: "清潔感",
};

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const lastDay = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;

  return (
    day >= 1 &&
    day <= lastDay &&
    Number(hourText) <= 23 &&
    Number(minuteText) <= 59 &&
    Number(secondText) <= 59 &&
    (offsetHourText === undefined || Number(offsetHourText) <= 23) &&
    (offsetMinuteText === undefined || Number(offsetMinuteText) <= 59)
  );
}

function roundRating(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function normalizeMetric(
  metric: ApprovedShopReviewMetric,
  totalApproved: number,
): { value: number; count: number } | null {
  const count = metric.responseCount;
  if (!Number.isSafeInteger(count) || count < 0 || count > totalApproved) return null;
  if (count === 0) return metric.average === null ? { value: 0, count: 0 } : null;

  const average = metric.average;
  if (
    typeof average !== "number" ||
    !Number.isFinite(average) ||
    average < 1 ||
    average > 5
  ) {
    return null;
  }

  return { value: roundRating(average), count };
}

function latestReviews(reviews: ApprovedShopReview[]): ApprovedShopReview[] {
  return reviews
    .map((review, index) => ({
      review,
      index,
      timestamp: isValidIsoDate(review.submittedAt)
        ? Date.parse(review.submittedAt)
        : null,
    }))
    .sort((left, right) => {
      if (left.timestamp === null && right.timestamp !== null) return 1;
      if (left.timestamp !== null && right.timestamp === null) return -1;
      if (left.timestamp !== null && right.timestamp !== null && left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp;
      }
      return left.index - right.index;
    })
    .slice(0, 3)
    .map(({ review }) => review);
}

function normalizeDateRange(
  dateRange: {
    oldestSubmittedAt: string;
    latestSubmittedAt: string;
  } | null,
): { oldestSubmittedAt: string | null; latestSubmittedAt: string | null } {
  if (!dateRange) {
    return { oldestSubmittedAt: null, latestSubmittedAt: null };
  }

  const latestSubmittedAt = isValidIsoDate(dateRange.latestSubmittedAt)
    ? dateRange.latestSubmittedAt
    : null;
  let oldestSubmittedAt = isValidIsoDate(dateRange.oldestSubmittedAt)
    ? dateRange.oldestSubmittedAt
    : null;

  if (
    oldestSubmittedAt &&
    latestSubmittedAt &&
    Date.parse(oldestSubmittedAt) > Date.parse(latestSubmittedAt)
  ) {
    oldestSubmittedAt = null;
  }

  return { oldestSubmittedAt, latestSubmittedAt };
}

function approvedReviewRelation(
  reviewId: number,
  context: ReviewRelationContext | undefined,
): ReviewRelationView | null {
  if (
    !Number.isSafeInteger(reviewId) ||
    reviewId <= 0 ||
    !context ||
    !Number.isSafeInteger(context.shopId) ||
    context.shopId <= 0 ||
    !Number.isSafeInteger(context.areaId) ||
    context.areaId <= 0 ||
    !context.shopSlug ||
    context.shopSlug.trim() !== context.shopSlug ||
    !context.areaSlug ||
    context.areaSlug.trim() !== context.areaSlug
  ) {
    return null;
  }

  return {
    reviewId,
    shopId: context.shopId,
    shopSlug: context.shopSlug,
    areaId: context.areaId,
    areaSlug: context.areaSlug,
    therapistId: null,
  };
}

export function buildApprovedShopReviewRelations(
  result: ApprovedShopReviewResult,
  relationContext?: ReviewRelationContext,
): ReviewRelationView[] {
  if (result.status === "unavailable") return [];
  return result.page.reviews.flatMap((review) => {
    const relation = approvedReviewRelation(review.id, relationContext);
    return relation ? [relation] : [];
  });
}

export function buildShopReviewViewModel(
  result: ApprovedShopReviewResult,
): ShopReviewViewModel {
  if (result.status === "unavailable") return result;

  const { page } = result;
  const totalApproved = page.total;
  const normalizedMetrics = (
    ["total", "price", "service", "cleanliness"] as const
  ).map((key) => ({
    key,
    metric: normalizeMetric(page.metrics[key], totalApproved),
  }));
  const totalMetric = normalizedMetrics[0].metric;
  const aggregateRatingCount = totalMetric?.count ?? 0;
  const showGraph = Boolean(
    totalMetric && totalMetric.count >= MINIMUM_GRAPH_RESPONSES,
  );

  return {
    status: "available",
    totalApproved,
    showGraph,
    aggregateRating: showGraph && totalMetric ? totalMetric.value : null,
    aggregateRatingCount,
    metrics: normalizedMetrics.flatMap(({ key, metric }) =>
      metric && metric.count >= MINIMUM_GRAPH_RESPONSES
        ? [{ key, label: METRIC_LABELS[key], value: metric.value, count: metric.count }]
        : [],
    ),
    latest: latestReviews(page.reviews),
    dateRange: normalizeDateRange(page.dateRange),
  };
}
