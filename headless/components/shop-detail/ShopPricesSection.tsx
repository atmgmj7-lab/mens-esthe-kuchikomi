import { formatPriceForDisplay } from "@/lib/price-normalization";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopPricesSection({ model }: { model: ShopDetailViewModel }) {
  return (
    <section id="prices" className={styles.section}>
      <div className={styles.sectionHeading}><p className={styles.kicker}>PRICE &amp; RESERVATION</p><h2>料金・予約</h2></div>
      <table className={styles.table}>
        <tbody>
          {model.prices.map(({ key, label, price }) => (
            <tr key={key}><th scope="row">{label}</th><td>{formatPriceForDisplay(price)}</td></tr>
          ))}
        </tbody>
      </table>
      {model.actions.some((action) => action.kind !== "official") ? (
        <p className={styles.sourceNote}>予約はページ上部の、店舗が公開している予約先から確認できます。</p>
      ) : null}
    </section>
  );
}
