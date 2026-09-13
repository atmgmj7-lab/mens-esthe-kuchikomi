import { PromotionDisclosureBadge } from "@/components/common/PromotionDisclosureBadge";
import type { VerifiedLineAreaShop } from "@/lib/area-verified-line-comparison";
import styles from "./AreaVerifiedLineSection.module.css";

const INITIAL_SHOPS = 6;

function ShopList({ shops }: { shops: readonly VerifiedLineAreaShop[] }) {
  return (
    <ul className={styles.list}>
      {shops.map((shop) => (
        <li key={shop.shopId} className={styles.item} data-verified-line-shop={shop.shopId}>
          <div className={styles.name}>
            <span>{shop.name}</span>
            {shop.isPr ? <PromotionDisclosureBadge /> : null}
          </div>
          <div className={styles.links}>
            <a href={shop.lineUrl} rel={shop.outboundRel}>LINEへ</a>
            <a href={shop.shopDetailUrl}>店舗詳細</a>
            <a href={shop.sourceUrl} rel={shop.outboundRel}>確認元（公式）</a>
          </div>
          <p className={styles.date}>公式確認日：<time dateTime={shop.reviewedAt}>{shop.reviewedAt.slice(0, 10)}</time></p>
        </li>
      ))}
    </ul>
  );
}

export function AreaVerifiedLineSection({ shops }: { shops: readonly VerifiedLineAreaShop[] }) {
  if (shops.length === 0) return null;
  const remaining = shops.slice(INITIAL_SHOPS);
  return (
    <section id="area-verified-line" className={`area-hub-section ${styles.section}`} aria-labelledby="area-verified-line-title">
      <h2 id="area-verified-line-title" className={styles.title}>LINE予約が確認できる店舗</h2>
      <p className={styles.intro}>
        店舗公式サイトでLINEへの導線を確認できた{shops.length}店舗です。
        空き状況や即時予約の可否を示すものではありません。最新の受付状況はリンク先でご確認ください。
      </p>
      <ShopList shops={shops.slice(0, INITIAL_SHOPS)} />
      {remaining.length > 0 ? (
        <details className={styles.more}>
          <summary>ほか{remaining.length}店舗のLINE導線を見る</summary>
          <ShopList shops={remaining} />
        </details>
      ) : null}
    </section>
  );
}
