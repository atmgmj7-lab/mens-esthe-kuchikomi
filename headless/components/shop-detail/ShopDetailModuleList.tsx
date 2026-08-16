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
      <div className={styles.sectionHeading}><p className={styles.kicker}>REVIEWS &amp; EXPERIENCE</p><h2>口コミ・体験</h2></div>
      <div className={styles.reviews}><ShopReviewDashboard model={context.review} /></div>
      <p className={styles.sourceNote}>承認済みユーザー口コミを、店舗紹介や掲載情報コメントとは分けて掲載しています。</p>
      {shopSlug ? (
        reviewPage && reviewPage.total > reviews.length ? (
          <Link href={`/shops/${shopSlug}/reviews/`} className={styles.textLink}>口コミをもっと見る（{reviewPage.total}件）</Link>
        ) : (
          <Link href={`/shops/${shopSlug}/reviews/`} className={styles.textLink}>この店舗の口コミ・体験一覧を見る</Link>
        )
      ) : null}
      <Link href="/reviews/" className={styles.textLink}>関西の口コミ・体験を探す</Link>
      <Link href={reviewSubmitUrl} className={styles.reviewSubmitLink}>この店舗の口コミを書く</Link>
    </section>
  );
}

function InformationModule({ context }: ModuleRendererProps) {
  return <ShopOverviewSection model={context.model} coverage={context.coverage} />;
}
function PricesModule({ context }: ModuleRendererProps) { return <ShopPricesSection model={context.model} />; }
function FeaturesModule({ context }: ModuleRendererProps) { return <ShopFeaturesSection model={context.model} />; }
function AccessModule({ context }: ModuleRendererProps) { return <ShopAccessSection model={context.model} />; }
function BasicModule({ context, rel }: ModuleRendererProps) { return <ShopBasicInformationSection model={context.model} rel={rel} />; }
function NearbyModule({ nearbyContent }: ModuleRendererProps) {
  return <section id="nearby" className={styles.section}><div className={styles.sectionHeading}><p className={styles.kicker}>RELATED LINKS</p><h2>関連ページ</h2></div><div className={styles.nearbyContent}>{nearbyContent}</div></section>;
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
