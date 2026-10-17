import { EskomiReviewEntryForm } from "@/components/reviews/EskomiReviewEntryForm";

export const instant = false;

export default async function ReviewEntryPage({ params }: { params: Promise<{ entryHandle: string }> }) {
  const { entryHandle } = await params;
  return <main id="main_content" className="l-mainContent l-article hl-review-submit-page"><div className="l-mainContent__inner hl-page-inner"><section className="hl-contact-section"><h1 className="hl-contact-heading">口コミを投稿する</h1><EskomiReviewEntryForm entryHandle={entryHandle} shopName="投稿先を確認中" therapistName={null} /></section></div></main>;
}
