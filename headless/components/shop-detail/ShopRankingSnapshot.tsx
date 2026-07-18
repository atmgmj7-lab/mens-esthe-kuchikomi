import type { ShopRankingSnapshot as Ranking } from "@/lib/shop-information-coverage";
import styles from "./ShopDetail.module.css";

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function ShopRankingSnapshot({
  areaName,
  ranking
}: {
  areaName: string;
  ranking: Ranking;
}) {
  return (
    <section className={styles.rankingCard} aria-labelledby="shop-ranking-snapshot-title">
      <div className={styles.dashboardCardHeader}>
        <div>
          <p className={styles.dashboardEyebrow}>ESKOMI RANKING</p>
          <h3 id="shop-ranking-snapshot-title">Eskomi内順位</h3>
        </div>
        {ranking.isPr ? <span className={styles.prLabel}>PR</span> : null}
      </div>
      <p className={styles.rankingValue}>
        <strong>{ranking.rank}位</strong>
        <span>/ {ranking.totalEligibleShops}店舗</span>
      </p>
      <dl className={styles.rankingMeta}>
        <div><dt>対象地域</dt><dd>{areaName}</dd></div>
        <div><dt>算定根拠</dt><dd>{ranking.basis}</dd></div>
        <div>
          <dt>確認日</dt>
          <dd><time dateTime={ranking.observedAt}>{formatDate(ranking.observedAt)}</time></dd>
        </div>
      </dl>
    </section>
  );
}
