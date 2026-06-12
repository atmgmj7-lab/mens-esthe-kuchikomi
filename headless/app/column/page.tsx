import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { getLatestPosts } from "@/lib/wp/posts";

export const metadata: Metadata = pageMetadata({
  title: "コラム一覧",
  description: "Escomiの新着コラム・体験レポート一覧です。",
  path: "/column/"
});

export default async function ColumnIndexPage() {
  const posts = await getLatestPosts(24);

  return (
    <main className="es-page">
      <h1 className="page-title">コラム一覧</h1>
      <section className="es-section grid">
        {posts.map((post) => (
          <article className="article-card" key={post.id}>
            <p className="article-meta">{new Date(post.date).toLocaleDateString("ja-JP")}</p>
            <h3>
              <Link href={`/column/${post.slug}/`}>{post.title}</Link>
            </h3>
            {post.excerpt ? <p className="muted">{post.excerpt}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
