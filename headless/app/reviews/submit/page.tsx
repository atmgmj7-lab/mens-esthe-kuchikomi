import type { Metadata } from "next";
import Link from "next/link";
import { ReviewSubmitForm } from "@/components/reviews/ReviewSubmitForm";
import { filterReviewSubmitShops, normalizeReviewHubQuery } from "@/lib/review-hub";
import {
  normalizeReviewSubmitPrefillIdentifier,
  resolveReviewSubmitPrefill,
} from "@/lib/review-submit-prefill";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import {
  openPartnerReviewCampaign,
  recordPartnerReviewCampaignVisit,
} from "@/lib/partner/provisioning-service";
import { pageMetadata } from "@/lib/seo";
import { partnerReviewGrowthRepository } from "@/lib/supabase/partner-workspace";
import { getAllShopsForListing, getShopById, getShopBySlug } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "口コミを投稿する",
  description:
    "実際に利用した方の口コミを募集しています。投稿内容は運営側で確認後、掲載されます。",
  path: "/reviews/submit/",
  robots: {
    index: false,
    follow: false
  }
});

export const instant = false;

type Props = {
  searchParams: Promise<{ shop?: string | string[]; area?: string | string[]; campaign?: string | string[] }>;
};

export default async function ReviewSubmitPage({ searchParams }: Props) {
  return ReviewSubmitPageContent({ searchParams });
}

async function ReviewSubmitPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const areaContext = normalizeReviewHubQuery({ area: params.area }).area;
  const identifier = normalizeReviewSubmitPrefillIdentifier(params.shop);
  const candidate = identifier ? await getShopBySlug(identifier) : null;
  const campaignToken = typeof params.campaign === "string" ? params.campaign.trim() : "";
  const campaignReference = campaignToken
    ? await openPartnerReviewCampaign(campaignToken, partnerReviewGrowthRepository)
    : null;
  const campaignShop = campaignReference ? await getShopById(campaignReference.id) : null;
  const campaignMismatch = Boolean(campaignToken) && (!campaignReference || !campaignShop
    || campaignShop.publicationStatus !== "publish" || !candidate
    || campaignShop.id !== candidate.id
    || normalizePublicShopSlug(campaignShop.slug) !== normalizePublicShopSlug(candidate.slug));

  if (campaignMismatch) {
    return (
      <main id="main_content" className="l-mainContent l-article">
        <div className="l-mainContent__inner hl-page-inner">
          <section className="hl-contact-section">
            <h1 className="hl-contact-heading">口コミを投稿する</h1>
            <p className="hl-contact-error" role="alert">キャンペーンの投稿先店舗を確認できません。</p>
          </section>
        </div>
      </main>
    );
  }

  if (campaignToken && campaignShop) {
    const recorded = await recordPartnerReviewCampaignVisit(
      { token: campaignToken, event: "start" },
      partnerReviewGrowthRepository,
    );
    if (!recorded || recorded.id !== campaignShop.id) {
      return (
        <main id="main_content" className="l-mainContent l-article">
          <div className="l-mainContent__inner hl-page-inner">
            <section className="hl-contact-section">
              <h1 className="hl-contact-heading">口コミを投稿する</h1>
              <p className="hl-contact-error" role="alert">キャンペーンの投稿先店舗を確認できません。</p>
            </section>
          </div>
        </main>
      );
    }
  }

  const shop = resolveReviewSubmitPrefill(params.shop, candidate ? [candidate] : []);
  const validCampaignToken = campaignShop && shop ? campaignToken : undefined;

  if (!shop) {
    const allShops = await getAllShopsForListing();
    const shops = filterReviewSubmitShops(allShops, areaContext);
    const areaName = areaContext
      ? allShops.flatMap((shop) => shop.terms).find((term) => term.slug === areaContext)?.name ?? null
      : null;
    return (
      <main id="main_content" className="l-mainContent l-article">
        <div className="l-mainContent__inner hl-page-inner">
          <section className="hl-contact-section">
            <h1 className="hl-contact-heading">口コミを投稿する</h1>
            <p className="hl-review-form__lead">
              {areaName ? `${areaName}の公開店舗から、口コミの投稿先を選んでください。` : "公開店舗から、口コミの投稿先を選んでください。"}
            </p>
            {shops.length > 0 ? (
              <form className="hl-review-shop-selector" action="/reviews/submit/" method="get">
                {areaContext ? <input type="hidden" name="area" value={areaContext} /> : null}
                <label htmlFor="review-shop-select">口コミを投稿する店舗</label>
                <select id="review-shop-select" name="shop" required defaultValue="">
                  <option value="" disabled>店舗を選択してください</option>
                  {shops.map((shop) => <option value={shop.slug} key={shop.id}>{shop.title}</option>)}
                </select>
                <button type="submit" className="area-hub-btn area-hub-btn--primary">この店舗の投稿画面へ</button>
              </form>
            ) : (
              <p className="hl-contact-error" role="status">指定されたエリアに表示できる公開店舗がありません。</p>
            )}
            <p><Link href="/shops/">店舗一覧を見る</Link></p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main id="main_content" className="l-mainContent l-article">
      <div className="l-mainContent__inner hl-page-inner">
        <section className="hl-contact-section" aria-labelledby="review-submit-heading">
          <h1 id="review-submit-heading" className="hl-contact-heading">
            口コミを投稿する
          </h1>
          <p className="hl-review-form__lead">
            実際に利用した方の口コミを募集しています。投稿内容は運営側で確認後、掲載されます。
          </p>
          <ReviewSubmitForm shopSlug={shop.slug} shopTitle={shop.title} campaignToken={validCampaignToken} />
        </section>
      </div>
    </main>
  );
}
