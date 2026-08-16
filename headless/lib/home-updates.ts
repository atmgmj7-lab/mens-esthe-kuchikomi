import type { ApprovedGlobalReview, BlogPostView } from "@/lib/wp/types";

export type HomeUpdateItem = Readonly<{
  id: string;
  category: "review" | "column";
  categoryLabel: "口コミ" | "編集部コラム";
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  areaName: string | null;
  sourceLabel: "承認済みユーザー口コミ" | "編集部";
}>;

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function excerpt(value: string, maxLength = 92): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

export function buildHomeUpdates({
  reviews,
  posts,
  limit = 10,
}: {
  reviews: readonly ApprovedGlobalReview[];
  posts: readonly BlogPostView[];
  limit?: number;
}): readonly HomeUpdateItem[] {
  const items: HomeUpdateItem[] = [];

  for (const review of reviews) {
    if (!validDate(review.submittedAt) || !review.body.trim()) continue;
    items.push({
      id: `review:${review.id}`,
      category: "review",
      categoryLabel: "口コミ",
      title: `${review.shop.name}に新しい口コミが届きました`,
      summary: excerpt(review.body),
      url: `/shops/${review.shop.slug}/reviews/`,
      publishedAt: review.submittedAt,
      areaName: review.areas[0]?.name ?? null,
      sourceLabel: "承認済みユーザー口コミ",
    });
  }

  for (const post of posts) {
    if (!validDate(post.date) || !post.slug || !post.title.trim()) continue;
    items.push({
      id: `column:${post.id}`,
      category: "column",
      categoryLabel: "編集部コラム",
      title: post.title,
      summary: excerpt(post.excerpt),
      url: `/column/${post.slug}/`,
      publishedAt: post.date,
      areaName: null,
      sourceLabel: "編集部",
    });
  }

  const unique = new Map<string, HomeUpdateItem>();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }

  return Object.freeze(
    [...unique.values()]
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
      .slice(0, Math.max(0, limit))
      .map((item) => Object.freeze(item)),
  );
}
