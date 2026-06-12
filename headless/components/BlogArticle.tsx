import type { BlogPostView } from "@/lib/wp/types";

export function BlogArticle({ post }: { post: BlogPostView }) {
  return (
    <main className="es-page article">
      <article className="content-card" style={{ padding: 24 }}>
        <p className="eyebrow">COLUMN</p>
        <h1 className="page-title">{post.title}</h1>
        <p className="article-meta">
          公開日: {new Date(post.date).toLocaleDateString("ja-JP")} / 更新日:{" "}
          {new Date(post.modified).toLocaleDateString("ja-JP")}
        </p>
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={post.title}
            width={800}
            height={450}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{ borderRadius: 8, marginTop: 20 }}
          />
        ) : null}
        <div className="rich-text" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </article>
    </main>
  );
}
