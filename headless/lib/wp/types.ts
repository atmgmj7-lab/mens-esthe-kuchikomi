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
};

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
