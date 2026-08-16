import { ShopDetailActions } from "@/components/shop-detail/ShopDetailActions";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type { ShopReviewViewModel } from "@/lib/shop-review-view-model";
import styles from "./ShopDetail.module.css";

type ShopDetailHeroProps = {
  model: ShopDetailViewModel;
  review: ShopReviewViewModel;
  rel: string;
};

export function ShopDetailHero({ model, review, rel }: ShopDetailHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.kicker}>
            SHOP PROFILE{model.areaName ? ` · ${model.areaName.toUpperCase()}` : ""}
          </p>
          <h1 className={styles.title}>{model.title}</h1>
          {model.verifiedAt ? (
            <p className={styles.verified}>掲載情報の確認日 {model.verifiedAt}</p>
          ) : null}
        </div>
      </div>

      {model.facts.length > 0 ? (
        <dl className={styles.facts}>
          {model.facts.map((fact) => (
            <div key={fact.key}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {review.status === "available" ? (
        <p className={styles.heroReviewSummary}>
          <span>承認済み口コミ</span>
          <strong>{review.totalApproved}件</strong>
          {review.showGraph && review.aggregateRating !== null ? (
            <span>総合評価 {review.aggregateRating.toFixed(1)} / 5.0</span>
          ) : null}
        </p>
      ) : null}
      <ShopDetailActions model={model} rel={rel} position="hero" />
    </header>
  );
}
