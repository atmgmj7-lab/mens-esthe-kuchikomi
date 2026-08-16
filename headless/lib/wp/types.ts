import type { LegacyShopRecommendationRanking } from "@/lib/shop-ranking";
import type { StrictRankingAvailability } from "@/lib/ux-production-data-boundary";
export type WpRendered = {
  rendered?: string;
};

export type WpMedia = {
  source_url?: string;
  alt_text?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url?: string; width?: number; height?: number }>;
  };
};

export type WpTerm = {
  id: number;
  count: number;
  name: string;
  slug: string;
  parent: number;
  taxonomy?: string;
  description?: string;
  acf?: Record<string, unknown>;
};

export type WpPostBase = {
  id: number;
  date: string;
  modified: string;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  excerpt?: WpRendered;
  featured_media?: number;
  acf?: Record<string, unknown>;
  _embedded?: {
    "wp:featuredmedia"?: WpMedia[];
    "wp:term"?: WpTerm[][];
  };
};

export type ShopFactField =
  | "price"
  | "hours"
  | "access"
  | "booking"
  | "official"
  | "image";

export type ShopFactProvenance = {
  field: "price" | "hours" | "access" | "booking" | "official" | "image";
  sourceUrl: string;
  sourceType: "official-site" | "shop-provided" | "admin-verified";
  observedAt: string;
  reviewedAt: string;
  reviewStatus: "reviewed" | "pending" | "rejected";
  publishedValueHash: string;
};

export type ShopAreaRankingSnapshot = {
  areaSlug: string;
  rank: number;
  totalEligibleShops: number;
  basis: string;
  observedAt: string;
  isPr: boolean;
};

export type WpShop = WpPostBase & {
  official_url?: string;
  area_slug?: string;
  area?: number[];
};

export type ShopPrimaryAreaView = Readonly<{
  id: number;
  slug: string;
  name: string;
}>;

export type ShopMediaView = {
  mediaId: number | null;
  source: "legacy-featured" | "legacy-acf" | "fallback";
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

export type ShopView = {
  id: number;
  slug: string;
  link: string;
  title: string;
  contentHtml: string;
  excerpt: string;
  imageUrl: string;
  media: {
    cardSquare: ShopMediaView;
    detailBanner: null;
  };
  terms: WpTerm[];
  acf: Record<string, unknown>;
  officialUrl: string;
  areaSlug: string;
  primaryArea: ShopPrimaryAreaView | null;
  ranking: LegacyShopRecommendationRanking;
  strictRanking: StrictRankingAvailability;
};

export type ApprovedShopReview = {
  id: number;
  body: string;
  submittedAt: string | null;
  ratings: {
    total: number | null;
    price: number | null;
    service: number | null;
    cleanliness: number | null;
  };
};

export type ApprovedShopReviewMetric = {
  average: number | null;
  responseCount: number;
};

export type ApprovedShopReviewPage = {
  reviews: ApprovedShopReview[];
  total: number;
  totalPages: number;
  page: number;
  metrics: Record<
    "total" | "price" | "service" | "cleanliness",
    ApprovedShopReviewMetric
  >;
  dateRange: {
    oldestSubmittedAt: string;
    latestSubmittedAt: string;
  } | null;
};

export type ApprovedShopReviewResult =
  | { status: "available"; page: ApprovedShopReviewPage }
  | { status: "unavailable"; reason: "request-failed" | "invalid-response" };

export type ApprovedGlobalReviewArea = Readonly<{
  id: number;
  slug: string;
  name: string;
}>;

export type ApprovedGlobalReview = Readonly<{
  id: number;
  body: string;
  submittedAt: string | null;
  ratings: Readonly<{
    total: number | null;
    price: number | null;
    service: number | null;
    cleanliness: number | null;
  }>;
  shop: Readonly<{
    id: number;
    slug: string;
    name: string;
  }>;
  areas: readonly ApprovedGlobalReviewArea[];
}>;

export type ApprovedGlobalReviewPage = Readonly<{
  reviews: readonly ApprovedGlobalReview[];
  total: number;
  totalPages: number;
  page: number;
}>;

export type ApprovedGlobalReviewResult =
  | Readonly<{ status: "available"; page: ApprovedGlobalReviewPage }>
  | Readonly<{ status: "unavailable"; reason: "request-failed" | "invalid-response" }>;

export type AreaView = {
  id: number;
  slug: string;
  name: string;
  parent: number;
  count: number;
  description: string;
  acf: Record<string, unknown>;
};

export type BlogPostView = {
  id: number;
  slug: string;
  link: string;
  title: string;
  date: string;
  modified: string;
  contentHtml: string;
  excerpt: string;
  imageUrl: string;
  terms: WpTerm[];
  acf: Record<string, unknown>;
};
