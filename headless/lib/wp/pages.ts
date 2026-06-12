import { rendered, stripHtml, wpFetch } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
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
}
