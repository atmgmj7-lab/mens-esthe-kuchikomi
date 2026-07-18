import type { ShopInformationCoverage as Coverage } from "@/lib/shop-information-coverage";
import styles from "./ShopDetail.module.css";

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function ShopInformationCoverage({ coverage }: { coverage: Coverage }) {
  const percentage = (coverage.verifiedCount / coverage.totalCount) * 100;
  return (
    <section className={styles.coverageCard} aria-labelledby="shop-information-coverage-title">
      <div className={styles.dashboardCardHeader}>
        <div>
          <p className={styles.dashboardEyebrow}>INFORMATION CHECK</p>
          <h3 id="shop-information-coverage-title">店舗情報の確認状況</h3>
        </div>
        <strong className={styles.coverageCount}>
          確認済み {coverage.verifiedCount}/{coverage.totalCount}
        </strong>
      </div>
      <div
        className={styles.coverageTrack}
        role="img"
        aria-label={`6項目中${coverage.verifiedCount}項目を確認済み`}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <ul className={styles.coverageItems}>
        {coverage.items.map((item) => (
          <li key={item.key} data-verified={item.verified ? "true" : "false"}>
            <span aria-hidden="true">{item.verified ? "●" : "○"}</span>
            {item.label}
            <small>{item.verified ? "確認済み" : "未確認"}</small>
          </li>
        ))}
      </ul>
      {coverage.latestReviewedAt ? (
        <p className={styles.sourceNote}>
          最新確認日 <time dateTime={coverage.latestReviewedAt}>{formatDate(coverage.latestReviewedAt)}</time>
        </p>
      ) : null}
    </section>
  );
}
