import { ContactForm } from "@/components/ContactForm";
import { getStaticPageFallback, getStaticPageMeta, type StaticPageSlug } from "@/lib/static-pages";
import type { PageView } from "@/lib/wp/pages";

export function WpStaticPage({ slug, page }: { slug: StaticPageSlug; page: PageView | null }) {
  const meta = getStaticPageMeta(slug);
  const title = page?.title || meta.title;
  const contentHtml = page?.contentHtml?.trim()
    ? page.contentHtml
    : getStaticPageFallback(slug);

  return (
    <main className="l-mainContent hl-static-page" id="main_content">
      <div className="mep-container hl-page-inner hl-static-page-inner">
        <article className="hl-static-page-card hl-surface">
          <h1 className="hl-static-page-title">{title}</h1>
          <div className="rich-text hl-static-page-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />
          {slug === "contact" ? (
            <section className="hl-contact-section" aria-labelledby="contact-form-heading">
              <h2 id="contact-form-heading" className="hl-contact-heading">
                お問い合わせフォーム
              </h2>
              <ContactForm />
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}
