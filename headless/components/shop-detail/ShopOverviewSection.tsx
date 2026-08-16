import type {
  ShopInformationCoverage as Coverage
} from "@/lib/shop-information-coverage";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";
import { ShopInformationCoverage } from "./ShopInformationCoverage";

export function ShopOverviewSection({
  coverage,
  model
}: {
  coverage: Coverage | null;
  model: ShopDetailViewModel;
}) {
  const hasDescription = Boolean(
    model.catchText || model.introductionText || model.recommendText || model.summaryText
  );
  return (
    <section id="shop-information" className={styles.section}>
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>SHOP INFORMATION</p>
        <h2>こだわり・店舗紹介</h2>
      </div>
      {coverage ? (
        <div className={styles.informationDashboard}>
          <ShopInformationCoverage coverage={coverage} />
        </div>
      ) : null}
      {hasDescription ? (
        <div className={styles.overviewBody}>
          <h3>店舗紹介</h3>
          {model.catchText ? <p className={styles.catch}>{model.catchText}</p> : null}
          {model.introductionText ? <p className={styles.richText}>{model.introductionText}</p> : null}
          {model.recommendText ? <p>{model.recommendText}</p> : null}
          {model.summaryText ? (
            <div className={styles.sourceSeparated}>
              <strong>掲載情報コメント</strong>
              <p>{model.summaryText}</p>
              <small>公開情報をもとに整理した文章で、ユーザー口コミではありません。</small>
            </div>
          ) : null}
        </div>
      ) : !coverage ? (
        <p className={styles.sourceNote}>
          現在公開されている店舗情報を{model.infoRows.length}項目掲載しています。
        </p>
      ) : null}
    </section>
  );
}
