import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getPublicPartnerReviewWidget } from "@/lib/partner/provisioning-service";
import { resolvePublicPartnerWidget } from "@/lib/partner/partner-review-widget";
import { publicReviewAdapter } from "@/lib/reviews/public-adapter";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { getShopById } from "@/lib/wp/shops";
import { getV11Widget } from "@/lib/supabase/eskomi-widget-v11";

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

function excerpt(value: string): string {
  const normalized = value.trim();
  return normalized.length > 150 ? `${normalized.slice(0, 150)}…` : normalized;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(date);
}

function WidgetHeightReporter() {
  const code = `(()=>{let lastHeight=0,queued=false;const report=()=>{queued=false;const height=Math.max(240,Math.min(1200,Math.ceil(document.documentElement.scrollHeight)));if(Math.abs(height-lastHeight)<2)return;lastHeight=height;let origin="*";try{if(document.referrer)origin=new URL(document.referrer).origin;}catch{}window.parent.postMessage({type:"eskomi:review-widget:height",height},origin);};const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(report);};addEventListener("load",queue,{once:true});new ResizeObserver(queue).observe(document.body);queue();})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export default async function PartnerReviewWidgetPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  await connection();
  const token = (await params).token;
  const v11=await getV11Widget(token);
  if(v11) { const showAverage=v11.reviewCount>=3&&v11.averageRating!==null&&v11.averageRating>=1&&v11.averageRating<=5; return <><main className="hl-partner-widget" aria-label={`${v11.shopName}のEskomi口コミ`}><p className="hl-partner-widget__shop">{v11.shopName}</p><h2 className="hl-partner-widget__heading">Eskomiに寄せられた口コミ</h2><p>{showAverage?`評価 ${v11.averageRating} / 5（${v11.reviewCount}件）`:`有効な評価 ${v11.reviewCount}件`}</p>{v11.reviews.length===0?<p>公開済みの口コミはまだありません。</p>:<ul className="hl-partner-widget__reviews">{v11.reviews.map((review,index)=><li key={`${review.publishedAt}-${index}`}><p>{excerpt(review.body)}</p><small>{[formatDate(review.publishedAt),review.rating===null?null:`評価 ${review.rating} / 5`].filter(Boolean).join(" ・ ")}</small>{review.replyBody&&<p><strong>店舗からの返信</strong><br/>{review.replyBody}</p>}<small className="hl-partner-widget__source">出典：Eskomi</small></li>)}</ul>}<p className="hl-partner-widget__actions"><a href={v11.canonicalPath} target="_blank" rel="nofollow noopener noreferrer">Eskomiで口コミをもっと見る</a></p></main><WidgetHeightReporter/></>; }
  const campaign = await getPublicPartnerReviewWidget(token, partnerReviewGrowthRepository);
  if (!campaign) notFound();
  const shop = await getShopById(campaign.shopId);
  if (!shop || shop.publicationStatus !== "publish" || shop.slug !== campaign.shopSlug
    || `https://mens-esthe-kuchikomi.com/shops/${shop.slug}/` !== campaign.canonicalUrl) notFound();
  const reviews = await publicReviewAdapter.getShopReviews(shop, 1, 3);
  if (reviews.status !== "available") notFound();
  const widget = resolvePublicPartnerWidget({
    ...campaign,
    widgetUrl: `https://mens-esthe-kuchikomi.com/partner/widget/${token.toLowerCase()}/`,
    reviewCount: reviews.page.metrics.total.responseCount,
    averageRating: reviews.page.metrics.total.average,
  });
  if (widget.status !== "available") notFound();

  return <><main className="hl-partner-widget" aria-label={`${widget.shopName}のEskomi口コミ`}>
    <p className="hl-partner-widget__shop">{widget.shopName}</p>
    <h2 className="hl-partner-widget__heading">Eskomiに寄せられた口コミ</h2>
    <p>{widget.reviewSummary.kind === "average_and_count"
      ? `評価 ${widget.reviewSummary.average} / 5（${widget.reviewSummary.count}件）`
      : `有効な評価 ${widget.reviewSummary.count}件`}</p>
    <p className="hl-partner-widget__badge">{widget.badge}</p>
    {reviews.page.reviews.length === 0 ? <p>公開済みの口コミはまだありません。</p> : <ul className="hl-partner-widget__reviews">
      {reviews.page.reviews.map((review) => <li key={String(review.id)}>
        <p>{excerpt(review.body)}</p>
        <small>{[formatDate(review.submittedAt), review.ratings.total === null ? null : `評価 ${review.ratings.total} / 5`].filter(Boolean).join(" ・ ")}</small>
        <small className="hl-partner-widget__source">出典：Eskomi</small>
      </li>)}
    </ul>}
    <p className="hl-partner-widget__actions"><a href={campaign.canonicalUrl} target="_blank" rel="nofollow noopener noreferrer">Eskomiで口コミをもっと見る</a><a href={widget.reviewUrl} target="_blank" rel="nofollow noopener noreferrer">口コミを書く</a></p>
  </main><WidgetHeightReporter /></>;
}
