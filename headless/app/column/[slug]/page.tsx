import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BlogArticle } from "@/components/BlogArticle";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { getPostBySlug } from "@/lib/wp/posts";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: makeDescription(post.excerpt, `${post.title}の記事ページです。`),
    path: `/column/${post.slug}/`
  });
}

export default function ColumnPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="l-mainContent l-article" />}>
      <ColumnPageContent params={params} />
    </Suspense>
  );
}

async function ColumnPageContent({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  return <BlogArticle post={post} />;
}
