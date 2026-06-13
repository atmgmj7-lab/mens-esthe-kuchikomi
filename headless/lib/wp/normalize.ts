import { rendered, safeText, stripHtml } from "@/lib/wp/client";
import type { BlogPostView, ShopView, WpPostBase, WpShop, WpTerm } from "@/lib/wp/types";

const SITE_WP_CONTENT_PREFIXES = [
  "http://mens-esthe-kuchikomi.com/wp-content/",
  "https://mens-esthe-kuchikomi.com/wp-content/"
] as const;

export function normalizeImageUrl(url: string): string {
  if (!url) return "";

  for (const prefix of SITE_WP_CONTENT_PREFIXES) {
    if (url.startsWith(prefix)) {
      return url.slice(url.indexOf("/wp-content/"));
    }
  }

  return url;
}

export function featuredImage(post: WpPostBase): string {
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
  return {
    id: post.id,
    slug: post.slug,
    link: post.link,
    title,
    contentHtml: rendered(post.content),
    excerpt: stripHtml(rendered(post.excerpt)),
    imageUrl: featuredImage(post),
    terms: embeddedTerms(post),
    acf,
    officialUrl: safeText(post.official_url || acf.official_url),
    areaSlug: safeText(post.area_slug)
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
