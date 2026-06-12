import { wpFetch, wpFetchPaginated } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizePost } from "@/lib/wp/normalize";
import type { BlogPostView, WpPostBase } from "@/lib/wp/types";

export async function getLatestPosts(limit = 6): Promise<BlogPostView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "posts", `posts:list:${limit}`);
  const posts = await wpFetch<WpPostBase[]>(`/wp/v2/posts?per_page=${limit}&_embed=1`);
  return posts.map(normalizePost);
}

export type PostSitemapEntry = {
  slug: string;
  modified: string;
};

export async function getPostsForSitemap(): Promise<PostSitemapEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "posts", "posts:sitemap");

  const perPage = 100;
  const entries: PostSitemapEntry[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data, pagination } = await wpFetchPaginated<WpPostBase[]>(
      `/wp/v2/posts?per_page=${perPage}&page=${page}&orderby=modified&order=desc&_fields=slug,modified`
    );
    entries.push(...data.map((post) => ({ slug: post.slug, modified: post.modified })));
    totalPages = pagination.totalPages;
    page += 1;
  }

  return entries;
}

export async function getPostBySlug(slug: string): Promise<BlogPostView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "posts", `post:${slug}`);
  const posts = await wpFetch<WpPostBase[]>(`/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`);
  return posts[0] ? normalizePost(posts[0]) : null;
}
