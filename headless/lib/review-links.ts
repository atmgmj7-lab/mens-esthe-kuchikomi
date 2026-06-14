export function buildReviewSubmitUrl(shopSlug: string): string {
  return `/reviews/submit?shop=${encodeURIComponent(shopSlug)}`;
}
