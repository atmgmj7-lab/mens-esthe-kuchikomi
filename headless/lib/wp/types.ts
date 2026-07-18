import type { PromotionDisclosure } from "@/lib/promotion-disclosure";
export type WpRendered = {
  rendered?: string;
};

export type WpMedia = {
  source_url?: string;
  alt_text?: string;
  media_details?: {
    sizes?: Record<string, { source_url?: string }>;
  };
};

export type WpTerm = {
  id: number;
  count: number;
  name: string;
  slug: string;
  parent: number;
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

export type ShopRankingMeta = {
  manualRank: number | null;
  rankingPriority: number | null;
  isRankingEnabled: boolean;
  rankingReason: string;
  isPr: boolean;
  rankingLabel: string;
  promotion: PromotionDisclosure;
};

export type WpShop = WpPostBase & {
  official_url?: string;
  area_slug?: string;
};

export type ShopView = {
  id: number;
  slug: string;
  link: string;
  title: string;
  contentHtml: string;
  excerpt: string;
  imageUrl: string;
  terms: WpTerm[];
  acf: Record<string, unknown>;
  officialUrl: string;
  areaSlug: string;
  ranking: ShopRankingMeta;
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
