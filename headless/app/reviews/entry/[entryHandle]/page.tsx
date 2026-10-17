import { EskomiReviewEntryForm } from "@/components/reviews/EskomiReviewEntryForm";
import { eskomiReviewV2Repository } from "@/lib/supabase/eskomi-review-v2";

export const instant = false;

export default async function ReviewEntryPage({ params }: { params: Promise<{ entryHandle: string }> }) {
  const { entryHandle } = await params;
  const entry = await eskomiReviewV2Repository.resolveEntry(entryHandle);
  const publications = entry ? await eskomiReviewV2Repository.listPublications(entry.shopSlug) : null;
  return <main id="main_content" className="l-mainContent l-article hl-review-submit-page"><div className="l-mainContent__inner hl-page-inner"><section className="hl-contact-section"><h1 className="hl-contact-heading">口コミを投稿する</h1><EskomiReviewEntryForm entryHandle={entryHandle} shopName={entry?.shopName ?? "投稿先を確認中"} therapistName={entry?.therapistDisplayName ?? null} /></section>{publications?.length ? <section className="hl-contact-section" aria-labelledby="review-entry-public-heading"><h2 id="review-entry-public-heading">この店舗の公開口コミ</h2><ul>{publications.map((publication) => <li key={publication.publicHandle}><p>{publication.body}</p>{publication.rating !== null ? <p>店舗評価：{publication.rating} / 5</p> : null}</li>)}</ul></section> : null}</div></main>;
}
