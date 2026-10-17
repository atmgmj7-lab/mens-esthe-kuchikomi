import { notFound } from "next/navigation";

import { EskomiReviewEntryForm } from "@/components/reviews/EskomiReviewEntryForm";
import { eskomiReviewV2Repository } from "@/lib/supabase/eskomi-review-v2";

export const instant = false;

export default async function ReviewEntryPage({ params }: { params: Promise<{ entryHandle: string }> }) {
  const { entryHandle } = await params;
  const entry = await eskomiReviewV2Repository.resolveEntry(entryHandle);
  if (!entry) notFound();
  const publications = await eskomiReviewV2Repository.listPublications(entry.shopSlug);
  return <main id="main_content" className="l-mainContent l-article hl-review-submit-page"><div className="l-mainContent__inner hl-page-inner"><section className="hl-contact-section"><h1 className="hl-contact-heading">口コミを投稿する</h1><EskomiReviewEntryForm entryHandle={entry.entryHandle} shopName={entry.shopName} therapistName={entry.therapistDisplayName} /></section><section className="hl-contact-section" aria-labelledby="approved-review-heading"><h2 id="approved-review-heading">この店舗の承認済み口コミ</h2>{publications === null ? <p role="status">口コミを現在取得できません。</p> : publications.length === 0 ? <p>承認済み口コミはまだありません。</p> : <div className="hl-review-list">{publications.map((review) => <article key={review.publicHandle}><p><strong>{review.displayName}</strong>・評価 {review.rating} / 5{review.therapistDisplayName ? `・${review.therapistDisplayName}さん` : ""}</p><p>{review.body}</p></article>)}</div>}</section></div></main>;
}
