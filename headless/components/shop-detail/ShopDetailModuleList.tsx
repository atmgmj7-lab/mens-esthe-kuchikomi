import Link from "next/link";
import type { ReactNode } from "react";
import type {
  ShopDetailModuleContext,
  VisibleShopDetailModule
} from "@/lib/shop-detail-modules";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import type { ApprovedShopReviewResult } from "@/lib/wp/types";
import styles from "./ShopDetail.module.css";
import { ShopAccessSection } from "./ShopAccessSection";
import { ShopBasicInformationSection } from "./ShopBasicInformationSection";
import { ShopFeaturesSection } from "./ShopFeaturesSection";
import { ShopOverviewSection } from "./ShopOverviewSection";
import { ShopPricesSection } from "./ShopPricesSection";
import { ShopReviewDashboard } from "./ShopReviewDashboard";

type ModuleRendererProps = {
  context: ShopDetailModuleContext;
  nearbyContent: ReactNode;
  rel: string;
  reviewResult: ApprovedShopReviewResult;
  reviewSubmitUrl: string;
};

function ReviewsModule({ context, reviewResult, reviewSubmitUrl }: ModuleRendererProps) {
  const shopSlug = normalizePublicShopSlug(context.model.slug);
  const reviewPage = reviewResult.status === "available" ? reviewResult.page : null;
  const reviews = reviewPage?.reviews ?? [];
  return (
    <section id="reviews" className={styles.section}>
      <div className={styles.sectionHeading}><p className={styles.kicker}>USER REVIEWS</p><h2>ユーザー口コミ</h2></div>
      <div className={styles.reviews}><ShopReviewDashboard model={context.review} /></div>
      <p className={styles.sourceNote}>掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません。</p>
      {reviewPage && reviewPage.total > reviews.length ? (
        <Link href={`/shops/${shopSlug}/reviews/`} className={styles.textLink}>承認済み口コミをすべて見る（{reviewPage.total}件）</Link>
      ) : null}
      <Link href={reviewSubmitUrl} className={styles.textLink}>この店舗の口コミを投稿する</Link>
    </section>
  );
}

function InformationModule({ context }: ModuleRendererProps) {
  return <ShopOverviewSection model={context.model} coverage={context.coverage} ranking={context.ranking} />;
}
function PricesModule({ context }: ModuleRendererProps) { return <ShopPricesSection model={context.model} />; }
function FeaturesModule({ context }: ModuleRendererProps) { return <ShopFeaturesSection model={context.model} />; }
function AccessModule({ context }: ModuleRendererProps) { return <ShopAccessSection model={context.model} />; }
function BasicModule({ context, rel }: ModuleRendererProps) { return <ShopBasicInformationSection model={context.model} rel={rel} />; }
function NearbyModule({ nearbyContent }: ModuleRendererProps) {
  return <section id="nearby" className={styles.section}><div className={styles.sectionHeading}><p className={styles.kicker}>AREA LINKS</p><h2>周辺・関連情報</h2></div><div className={styles.nearbyContent}>{nearbyContent}</div></section>;
}

const MODULE_RENDERERS = {
  reviews: ReviewsModule,
  information: InformationModule,
  prices: PricesModule,
  features: FeaturesModule,
  access: AccessModule,
  basic: BasicModule,
  nearby: NearbyModule
} as const;

export function ShopDetailModuleList({
  context,
  modules,
  nearbyContent,
  rel,
  reviewResult,
  reviewSubmitUrl
}: ModuleRendererProps & { modules: readonly VisibleShopDetailModule[] }) {
  const props = { context, nearbyContent, rel, reviewResult, reviewSubmitUrl };
  return (
    <div className={styles.sections}>
      {modules.map((module) => {
        const Renderer = MODULE_RENDERERS[module.renderer];
        return <Renderer key={module.id} {...props} />;
      })}
    </div>
  );
}
