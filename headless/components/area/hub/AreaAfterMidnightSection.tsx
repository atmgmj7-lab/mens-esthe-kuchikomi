import { PromotionDisclosureBadge } from "@/components/common/PromotionDisclosureBadge";
import type { AfterMidnightAreaShop } from "@/lib/area-after-midnight-comparison";
import styles from "./AreaVerifiedLineSection.module.css";

export function AreaAfterMidnightSection({ shops }: { shops: readonly AfterMidnightAreaShop[] }) {
  if (shops.length === 0) return null;
  return (
    <section id="area-after-midnight" className={`area-hub-section ${styles.section}`} aria-labelledby="area-after-midnight-title">
      <h2 id="area-after-midnight-title" className={styles.title}>24時以降営業が確認できる店舗</h2>
      <p className={styles.intro}>
        公式確認済みの営業時間で、24:00を超えて営業することが確認できる{shops.length}店舗です。
        現在営業中や予約の可否を示すものではありません。最新の営業時間は公式サイトでご確認ください。
      </p>
      <details className={styles.more}>
        <summary>{shops.length}店舗の営業時間を比較する</summary>
        <ul className={styles.list}>
          {shops.map((shop) => (
            <li key={shop.shopId} className={styles.item} data-after-midnight-shop={shop.shopId}>
              <div className={styles.name}>
                <span>{shop.name}</span>
                {shop.isPr ? <PromotionDisclosureBadge /> : null}
              </div>
              <p className={styles.intro}>営業時間：{shop.hours}</p>
              <div className={styles.links}>
                <a href={shop.shopDetailUrl}>店舗詳細</a>
                <a href={shop.sourceUrl} rel={shop.outboundRel}>確認元（公式）</a>
              </div>
              <p className={styles.date}>公式確認日：<time dateTime={shop.reviewedAt}>{shop.reviewedAt.slice(0, 10)}</time></p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
