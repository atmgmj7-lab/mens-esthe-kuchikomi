export function buildReviewSubmitUrl(shopSlug: string): string {
  return `/reviews/submit?shop=${encodeURIComponent(shopSlug)}`;
}

export type ReviewEntryInput =
  | { page: "top" | "hub" }
  | { page: "area"; areaSlug: string }
  | { page: "shop"; shopSlug: string }
  | { page: "therapist"; therapistId?: unknown; therapistName?: string };

export type ReviewEntryContext =
  | { scope: "none" }
  | { scope: "area"; areaSlug: string; transport: "frontend-only-prefilter" }
  | { scope: "shop"; shopSlug: string; transport: "existing-shop-query"; url: string };

function validSlug(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

export function buildReviewEntryContext(input: ReviewEntryInput): ReviewEntryContext {
  if (input.page === "area" && validSlug(input.areaSlug)) {
    return {
      scope: "area",
      areaSlug: input.areaSlug,
      transport: "frontend-only-prefilter",
    };
  }

  if (input.page === "shop" && validSlug(input.shopSlug)) {
    return {
      scope: "shop",
      shopSlug: input.shopSlug,
      transport: "existing-shop-query",
      url: buildReviewSubmitUrl(input.shopSlug),
    };
  }

  return { scope: "none" };
}
