import type { CSSProperties } from "react";
import type { ShopReviewViewModel } from "@/lib/shop-review-view-model";
import styles from "./ShopDetail.module.css";

type ShopReviewDashboardProps = {
  model: ShopReviewViewModel;
};

function formatReviewDate(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function reviewPeriodLabel(
  dateRange: Extract<ShopReviewViewModel, { status: "available" }>["dateRange"],
): string | null {
  const oldest = formatReviewDate(dateRange.oldestSubmittedAt);
  const latest = formatReviewDate(dateRange.latestSubmittedAt);
  if (oldest && latest) return `口コミ対象期間 ${oldest}〜${latest}`;
  if (latest) return `最新投稿日 ${latest}`;
  return null;
}

function metricWidth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, (value / 5) * 100));
}

export function ShopReviewDashboard({ model }: ShopReviewDashboardProps) {
  if (model.status === "unavailable") {
    return (
      <p role="status">
        口コミ情報を現在取得できません。時間をおいて再度ご確認ください。
      </p>
    );
  }

  const periodLabel = reviewPeriodLabel(model.dateRange);
  const detailMetrics = model.metrics.filter(({ key }) => key !== "total");

  return (
    <div className={styles.reviewDashboard}>
      <div className={styles.reviewMeta}>
        <p>
          承認済み口コミ <strong>{model.totalApproved}</strong>件
        </p>
        {periodLabel ? <p>{periodLabel}</p> : null}
      </div>

      {model.showGraph && model.aggregateRating !== null ? (
        <div
          className={styles.reviewGraph}
          role="group"
          aria-label="承認済み口コミの評価グラフ"
        >
          <div className={styles.reviewRingSummary}>
            <div className={styles.reviewRing}>
              <svg
                viewBox="0 0 120 120"
                role="img"
                aria-label={`総合評価 5点満点中${model.aggregateRating.toFixed(1)}、${model.aggregateRatingCount}件の回答`}
              >
                <circle className={styles.reviewRingTrack} cx="60" cy="60" r="50" pathLength="100" />
                <circle
                  className={styles.reviewRingValue}
                  cx="60"
                  cy="60"
                  r="50"
                  pathLength="100"
                  strokeDasharray={`${metricWidth(model.aggregateRating)} 100`}
                />
              </svg>
              <span className={styles.reviewRingNumber} aria-hidden="true">
                <strong>{model.aggregateRating.toFixed(1)}</strong>
                <small>/ 5.0</small>
              </span>
            </div>
            <p>総合評価</p>
            <small>{model.aggregateRatingCount}件の有効回答</small>
          </div>

          {detailMetrics.length > 0 ? (
            <ul className={styles.reviewMetricList} aria-label="評価項目別の平均">
              {detailMetrics.map((metric) => (
                <li
                  key={metric.key}
                  aria-label={`${metric.label} 5点満点中${metric.value.toFixed(1)}、${metric.count}件の回答`}
                >
                  <div className={styles.reviewMetricHeader}>
                    <span>{metric.label}</span>
                    <span>
                      <strong>{metric.value.toFixed(1)}</strong>
                      <small>{metric.count}件</small>
                    </span>
                  </div>
                  <span className={styles.reviewMetricTrack} aria-hidden="true">
                    <span
                      className={styles.reviewMetricValue}
                      style={{ width: `${metricWidth(metric.value)}%` } as CSSProperties}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className={styles.reviewGraphNote}>
          評価グラフは承認済み評価3件以上で表示します。
        </p>
      )}

      {model.latest.length > 0 ? (
        <div className={styles.reviewLatest}>
          <h3>最新の承認済み口コミ</h3>
          <div className={styles.reviews}>
            {model.latest.map((review) => {
              const submittedAtLabel = formatReviewDate(review.submittedAt);
              return (
                <article key={review.id}>
                  <p>{review.body}</p>
                  {submittedAtLabel && review.submittedAt ? (
                    <small>
                      投稿日 <time dateTime={review.submittedAt}>{submittedAtLabel}</time>
                    </small>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <p>この店舗の承認済みユーザー口コミはまだありません。</p>
      )}
    </div>
  );
}
