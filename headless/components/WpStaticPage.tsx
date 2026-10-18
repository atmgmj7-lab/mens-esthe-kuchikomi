import { ContactForm } from "@/components/ContactForm";
import { StoreListingGuide } from "@/components/StoreListingGuide";
import type { ShopOwnerRequestInitial } from "@/lib/shop-owner-request-links";
import { getStaticPageFallback, getStaticPageMeta, type StaticPageSlug } from "@/lib/static-pages";
import type { PageView } from "@/lib/wp/pages";

type WpStaticPageProps = {
  slug: StaticPageSlug;
  page: PageView | null;
  ownerRequestInitial?: ShopOwnerRequestInitial;
};

export function WpStaticPage({ slug, page, ownerRequestInitial }: WpStaticPageProps) {
  const meta = getStaticPageMeta(slug);
  const title = page?.title || meta.title;
  const contentHtml = page?.contentHtml?.trim()
    ? page.contentHtml
    : getStaticPageFallback(slug);
  const hasOwnerRequestTarget = Boolean(
    ownerRequestInitial?.shopId
    && ownerRequestInitial.shopSlug
    && ownerRequestInitial.shopName
    && ownerRequestInitial.targetUrl,
  );

  return (
    <main className="l-mainContent hl-static-page" id="main_content">
      <div className="mep-container hl-page-inner hl-static-page-inner">
        <article className="hl-static-page-card hl-surface">
          <h1 className="hl-static-page-title">{title}</h1>
          <div className="rich-text hl-static-page-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />
          {slug === "contact" || slug === "advertise" ? (
            <section className="hl-contact-section" aria-labelledby="contact-form-heading">
              <h2 id="contact-form-heading" className="hl-contact-heading">
                {slug === "advertise" ? "広告掲載の相談フォーム" : "お問い合わせフォーム"}
              </h2>
              <ContactForm defaultType={slug === "advertise" ? "掲載希望" : undefined} sourcePath={`/${slug}/`} />
            </section>
          ) : null}
          {slug === "storelisting" ? <StoreListingGuide existingInitial={hasOwnerRequestTarget ? ownerRequestInitial : undefined} /> : null}
        </article>
      </div>
    </main>
  );
}
