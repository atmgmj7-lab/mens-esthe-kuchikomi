import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WpStaticPage } from "@/components/WpStaticPage";
import {
  isStaticPageSlug,
  STATIC_PAGE_SLUGS,
  getStaticPageMeta,
  type StaticPageSlug
} from "@/lib/static-pages";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { getPageBySlug } from "@/lib/wp/pages";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return STATIC_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isStaticPageSlug(slug)) notFound();

  const page = await getPageBySlug(slug);
  const meta = getStaticPageMeta(slug);
  const title = page?.title || meta.title;
  const description = makeDescription(page?.excerpt || page?.contentHtml, meta.description);

  return pageMetadata({
    title,
    description,
    path: `/${slug}/`
  });
}

export default async function StaticWpPage({ params }: Props) {
  const { slug } = await params;
  if (!isStaticPageSlug(slug)) notFound();

  const page = await getPageBySlug(slug);
  return <WpStaticPage slug={slug} page={page} />;
}
