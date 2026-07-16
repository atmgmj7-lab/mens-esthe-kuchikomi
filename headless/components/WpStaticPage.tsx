import { ContactForm } from "@/components/ContactForm";
import { ShopOwnerRequestForm } from "@/components/ShopOwnerRequestForm";
import type { ShopOwnerRequestInitial } from "@/lib/shop-owner-request-links";
import { getStaticPageFallback, getStaticPageMeta, type StaticPageSlug } from "@/lib/static-pages";
import type { PageView } from "@/lib/wp/pages";

type WpStaticPageProps = {
  slug: StaticPageSlug;
  page: PageView | null;
  ownerRequestInitial?: ShopOwnerRequestInitial;
};

const EMPTY_OWNER_REQUEST_INITIAL: ShopOwnerRequestInitial = {
  shopId: "",
  shopSlug: "",
  shopName: "",
  targetUrl: "",
  source: "storelisting",
};

export function WpStaticPage({ slug, page, ownerRequestInitial }: WpStaticPageProps) {
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
          {slug === "storelisting" ? (
            <section
              id="shop-owner-request"
              className="hl-contact-section hl-owner-request-section"
              aria-labelledby="shop-owner-request-heading"
            >
              <p className="hl-static-page-kicker">FOR SHOP OWNER</p>
              <h2 id="shop-owner-request-heading" className="hl-contact-heading">
                掲載情報の登録・修正申請
              </h2>
              <p className="hl-owner-request-intro">
                申請内容は運営確認前に公開されません。現在の公開情報はWordPressのまま維持されます。
              </p>
              <ShopOwnerRequestForm initial={ownerRequestInitial ?? EMPTY_OWNER_REQUEST_INITIAL} />
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}
