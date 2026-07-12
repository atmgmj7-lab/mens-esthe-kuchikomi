import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NihonbashiGuidePage } from "@/components/NihonbashiGuidePage";
import { WpStaticPage } from "@/components/WpStaticPage";
import {
  NIHONBASHI_GUIDE_DESCRIPTION,
  NIHONBASHI_GUIDE_TITLE
} from "@/lib/nihonbashi-shop-utils";
import {
  isStaticPageSlug,
  STATIC_PAGE_SLUGS,
  getStaticPageMeta,
  type StaticPageSlug
} from "@/lib/static-pages";
import { makeDescription, pageMetadata } from "@/lib/seo";
import { withWpBuildFallback } from "@/lib/wp/build-resilience";
import { getAreaBySlug, getAreaShops } from "@/lib/wp/areas";
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

  if (slug === "osaka-nihonbashi") {
    return pageMetadata({
      title: NIHONBASHI_GUIDE_TITLE,
      description: NIHONBASHI_GUIDE_DESCRIPTION,
      path: "/osaka-nihonbashi/"
    });
  }

  const meta = getStaticPageMeta(slug);
  const page = await withWpBuildFallback(`static metadata ${slug}`, () => getPageBySlug(slug), null);
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

  if (slug === "osaka-nihonbashi") {
    const area = await withWpBuildFallback("nihonbashi guide area", () => getAreaBySlug("nihonbashi"), null);
    if (!area) {
      return <WpStaticPage slug={slug} page={null} />;
    }
    const { shops } = await withWpBuildFallback(
      "nihonbashi guide shops",
      () => getAreaShops(area.id, 1),
      { shops: [], totalPages: 1 }
    );
    return <NihonbashiGuidePage area={area} shops={shops} />;
  }

  const page = await withWpBuildFallback(`static page ${slug}`, () => getPageBySlug(slug), null);
  return <WpStaticPage slug={slug} page={page} />;
}
