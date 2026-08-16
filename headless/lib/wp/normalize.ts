import { normalizeShopRanking } from "@/lib/shop-ranking";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import { rendered, safeText, stripHtml } from "@/lib/wp/client";
import { encodeBrowserWpContentPath } from "@/lib/wp/path-encoding";
import type { BlogPostView, ShopMediaView, ShopView, WpPostBase, WpShop, WpTerm } from "@/lib/wp/types";

const SITE_WP_CONTENT_PREFIXES = [
  "http://mens-esthe-kuchikomi.com/wp-content/",
  "https://mens-esthe-kuchikomi.com/wp-content/"
] as const;

export function normalizeImageUrl(url: string): string {
  if (!url) return "";

  for (const prefix of SITE_WP_CONTENT_PREFIXES) {
    if (url.startsWith(prefix)) {
      return encodeBrowserWpContentPath(url.slice(url.indexOf("/wp-content/")));
    }
  }

  if (url.startsWith("/wp-content/")) {
    return encodeBrowserWpContentPath(url);
  }

  return url;
}

const SHOP_ACF_IMAGE_KEYS = [
  "shop_header_image",
  "header_image",
  "shop_top_image",
  "top_image",
  "shop_hero_image",
  "hero_image",
  "shop_main_visual",
  "main_visual",
  "shop_image",
  "shop_main_image",
  "main_image",
  "image",
  "shop_photo",
  "photo",
  "gallery_image",
  "store_image",
  "thumbnail"
] as const;

function extractAcfSizeUrl(size: unknown): string {
  if (typeof size === "string") return size;
  if (size && typeof size === "object" && "url" in size) {
    const url = (size as { url?: unknown }).url;
    if (typeof url === "string") return url;
  }
  return "";
}

function extractAcfImageUrl(value: unknown): string {
  if (!value || typeof value === "number") return "";

  if (typeof value === "string") {
    return value ? normalizeImageUrl(value) : "";
  }

  if (typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;

  if (typeof obj.url === "string" && obj.url) {
    return normalizeImageUrl(obj.url);
  }

  if (typeof obj.source_url === "string" && obj.source_url) {
    return normalizeImageUrl(obj.source_url);
  }

  const sizes = obj.sizes;
  if (sizes && typeof sizes === "object") {
    const sizesObj = sizes as Record<string, unknown>;
    const raw =
      extractAcfSizeUrl(sizesObj.large) ||
      extractAcfSizeUrl(sizesObj.medium_large) ||
      extractAcfSizeUrl(sizesObj.medium) ||
      extractAcfSizeUrl(sizesObj.full) ||
      "";
    if (raw) return normalizeImageUrl(raw);
  }

  return "";
}

function positiveDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function acfImageMetadata(value: unknown): Pick<ShopMediaView, "alt" | "width" | "height"> {
  if (!value || typeof value !== "object") return { alt: "" };
  const image = value as Record<string, unknown>;
  const alt = typeof image.alt === "string"
    ? image.alt
    : typeof image.alt_text === "string"
      ? image.alt_text
      : "";
  return {
    alt,
    width: positiveDimension(image.width),
    height: positiveDimension(image.height),
  };
}

function acfShopMedia(acf: Record<string, unknown>, fallbackAlt: string): ShopMediaView | null {
  for (const key of SHOP_ACF_IMAGE_KEYS) {
    const value = acf[key];
    const url = extractAcfImageUrl(value);
    if (!url) continue;
    const metadata = acfImageMetadata(value);
    return {
      mediaId: null,
      source: "legacy-acf",
      url,
      alt: metadata.alt || fallbackAlt,
      ...(metadata.width ? { width: metadata.width } : {}),
      ...(metadata.height ? { height: metadata.height } : {}),
    };
  }
  return null;
}

function featuredMediaView(post: WpShop, fallbackAlt: string): ShopMediaView | null {
  if (!Number.isSafeInteger(post.featured_media) || Number(post.featured_media) <= 0) return null;
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) return null;

  const candidates = [
    media.media_details?.sizes?.large,
    media.media_details?.sizes?.medium_large,
  ];
  const selectedSize = candidates.find((size) => Boolean(size?.source_url));
  const rawUrl = selectedSize?.source_url || media.source_url || "";
  if (!rawUrl) return null;

  return {
    mediaId: Number(post.featured_media),
    source: "legacy-featured",
    url: normalizeImageUrl(rawUrl),
    alt: media.alt_text || fallbackAlt,
    ...(positiveDimension(selectedSize?.width ?? media.media_details?.width)
      ? { width: positiveDimension(selectedSize?.width ?? media.media_details?.width) }
      : {}),
    ...(positiveDimension(selectedSize?.height ?? media.media_details?.height)
      ? { height: positiveDimension(selectedSize?.height ?? media.media_details?.height) }
      : {}),
  };
}

function shopCardMedia(post: WpShop, title: string): ShopMediaView {
  return featuredMediaView(post, title)
    || acfShopMedia(post.acf || {}, title)
    || {
      mediaId: null,
      source: "fallback",
      url: "",
      alt: title,
    };
}

export function featuredImage(post: WpPostBase): string {
  if (!post.featured_media) return "";

  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const raw =
    media?.media_details?.sizes?.large?.source_url ||
    media?.media_details?.sizes?.medium_large?.source_url ||
    media?.source_url ||
    "";
  return normalizeImageUrl(raw);
}

export function embeddedTerms(post: WpPostBase): WpTerm[] {
  return (post._embedded?.["wp:term"] || []).flat().filter(Boolean);
}

export function normalizeShop(post: WpShop): ShopView {
  const title = stripHtml(rendered(post.title));
  const acf = post.acf || {};
  const cardSquare = shopCardMedia(post, title);
  return {
    id: post.id,
    slug: post.slug,
    link: post.link,
    title,
    contentHtml: rendered(post.content),
    excerpt: stripHtml(rendered(post.excerpt)),
    imageUrl: cardSquare.url,
    media: {
      cardSquare,
      detailBanner: null,
    },
    terms: embeddedTerms(post),
    acf,
    officialUrl: safeText(post.official_url || acf.official_url),
    areaSlug: safeText(post.area_slug),
    ranking: normalizeShopRanking(acf),
    strictRanking: unavailableStrictRanking("shop")
  };
}

export function normalizePost(post: WpPostBase): BlogPostView {
  return {
    id: post.id,
    slug: post.slug,
    link: post.link,
    title: stripHtml(rendered(post.title)),
    date: post.date,
    modified: post.modified,
    contentHtml: rendered(post.content),
    excerpt: stripHtml(rendered(post.excerpt)),
    imageUrl: featuredImage(post),
    terms: embeddedTerms(post),
    acf: post.acf || {}
  };
}
