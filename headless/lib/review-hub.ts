import type { ApprovedGlobalReview, ShopView } from "@/lib/wp/types";

type RawSearchValue = string | string[] | undefined;

export type ReviewHubQuery = Readonly<{
  page: number;
  q: string;
  area: string;
  hasQuery: boolean;
}>;

function firstValue(value: RawSearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function validAreaSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/u.test(value);
}

export function normalizeReviewHubQuery(
  input: Record<string, RawSearchValue>,
): ReviewHubQuery {
  const rawPage = firstValue(input.page);
  const parsedPage = /^[1-9][0-9]*$/u.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(parsedPage) && parsedPage <= 1000 ? parsedPage : 1;
  const q = normalizeText(firstValue(input.q)).slice(0, 80);
  const rawArea = firstValue(input.area).trim().toLowerCase();
  const area = validAreaSlug(rawArea) ? rawArea : "";
  const hasQuery = Object.keys(input).some((key) => ["page", "q", "area"].includes(key));

  return Object.freeze({ page, q, area, hasQuery });
}

function searchableReviewText(review: ApprovedGlobalReview): string {
  return normalizeText([
    review.body,
    review.shop.name,
    ...review.areas.map((area) => area.name),
  ].join(" ")).toLocaleLowerCase("ja-JP");
}

export function filterReviewsForHub(
  reviews: readonly ApprovedGlobalReview[],
  filters: Pick<ReviewHubQuery, "q" | "area">,
): readonly ApprovedGlobalReview[] {
  const query = normalizeText(filters.q).toLocaleLowerCase("ja-JP");
  const queryTerms = query.split(" ").filter(Boolean);
  return reviews.filter((review) => {
    const areaMatches = !filters.area || review.areas.some((area) => area.slug === filters.area);
    const searchText = searchableReviewText(review);
    const queryMatches = queryTerms.length === 0 || queryTerms.every((term) => searchText.includes(term));
    return areaMatches && queryMatches;
  });
}

export function reviewsHubMetadataState(filters: ReviewHubQuery) {
  return {
    canonicalPath: "/reviews/",
    robots: { index: !filters.hasQuery, follow: true as const },
  };
}

export function buildReviewHubPageUrl(
  page: number,
  filters: { q?: string; area?: string },
): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (filters.q) params.set("q", filters.q);
  if (filters.area) params.set("area", filters.area);
  const query = params.toString();
  return query ? `/reviews/?${query}` : "/reviews/";
}

export function filterReviewSubmitShops<T extends Pick<ShopView, "areaSlug" | "terms">>(
  shops: readonly T[],
  areaSlug: string,
): readonly T[] {
  if (!validAreaSlug(areaSlug)) return shops;
  return shops.filter(
    (shop) => shop.areaSlug === areaSlug || shop.terms.some((term) => term.slug === areaSlug),
  );
}

export function buildReviewSubmitSelection(shopSlug: string, areaSlug = "") {
  const normalizedShop = shopSlug.trim();
  const normalizedArea = areaSlug.trim().toLowerCase();
  return {
    shopSlug: normalizedShop,
    areaSlug: validAreaSlug(normalizedArea) ? normalizedArea : "",
    transport: "existing-shop-query" as const,
  };
}

export function reviewsHubBreadcrumbJsonLd(
  toCanonical: (path: string) => string = (path) => new URL(path, "https://mens-esthe-kuchikomi.com").href,
) {
  const items = [
    { name: "TOP", item: toCanonical("/") },
    { name: "口コミ・体験", item: toCanonical("/reviews/") },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      ...item,
    })),
  };
}
