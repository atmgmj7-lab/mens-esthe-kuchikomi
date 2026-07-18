import { formatPriceForDisplay } from "@/lib/price-normalization";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopPricesSection({ model }: { model: ShopDetailViewModel }) {
  return (
    <section id="prices" className={styles.section}>
      <div className={styles.sectionHeading}><p className={styles.kicker}>PRICE</p><h2>料金プラン</h2></div>
      <table className={styles.table}>
        <tbody>
          {model.prices.map(({ key, label, price }) => (
            <tr key={key}><th scope="row">{label}</th><td>{formatPriceForDisplay(price)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
