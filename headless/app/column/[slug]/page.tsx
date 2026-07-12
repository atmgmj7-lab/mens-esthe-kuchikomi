import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/BlogArticle";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { getStaticParamsOrFallback, withWpBuildFallback } from "@/lib/wp/build-resilience";
import { getPostBySlug, getPostsForSitemap } from "@/lib/wp/posts";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getStaticParamsOrFallback(
    "column static params",
    getPostsForSitemap,
    (post) => ({
      slug: post.slug
    }),
    [{ slug: "hello-world" }]
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await withWpBuildFallback(`column metadata ${slug}`, () => getPostBySlug(slug), null);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: makeDescription(post.excerpt, `${post.title}の記事ページです。`),
    path: `/column/${post.slug}/`
  });
}

export default async function ColumnPage({ params }: Props) {
  const { slug } = await params;
  const post = await withWpBuildFallback(`column page ${slug}`, () => getPostBySlug(slug), null);
  if (!post) notFound();
  return <BlogArticle post={post} />;
}
