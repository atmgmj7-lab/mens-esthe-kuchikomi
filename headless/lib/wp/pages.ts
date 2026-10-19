import { rendered, stripHtml, wpFetch } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import { ContentMigrationIncompleteError, getSupabasePrimaryPublicDirectory, isSupabasePrimaryContent, publicDirectoryPage } from "@/lib/content-source/public-directory";
import type { WpPostBase } from "@/lib/wp/types";

export type PageView = {
  slug: string;
  title: string;
  contentHtml: string;
  excerpt: string;
  modified: string;
};

export async function getPageBySlug(slug: string): Promise<PageView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "pages", `page:${slug}`);
  if (isSupabasePrimaryContent()) {
    const page = publicDirectoryPage(await getSupabasePrimaryPublicDirectory(), slug);
    if (!page) throw new ContentMigrationIncompleteError(`Static page /${slug}/ has no canonical Supabase projection; migrate it before enabling Supabase-primary`);
    return page;
  }
  try {
    const pages = await wpFetch<WpPostBase[]>(
      `/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=slug,title,content,excerpt,modified`
    );
    const page = pages[0];
    if (!page) return null;

    return {
      slug: page.slug,
      title: stripHtml(rendered(page.title)),
      contentHtml: rendered(page.content),
      excerpt: stripHtml(rendered(page.excerpt)),
      modified: page.modified
    };
  } catch (error) {
    logWpBuildFallback(`page ${slug}`, error);
    return null;
  }
}
