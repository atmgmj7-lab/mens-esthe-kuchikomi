import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopAccessSection({ model }: { model: ShopDetailViewModel }) {
  const rows = model.infoRows.filter((row) => row.key === "address" || row.key === "station");
  return (
    <section id="map-access" className={styles.section}>
      <span id="hours-access" className={styles.sectionAnchor} aria-hidden="true" />
      <div className={styles.sectionHeading}><p className={styles.kicker}>MAP & ACCESS</p><h2>地図・アクセス</h2></div>
      <table className={styles.infoTable}><tbody>{rows.map((row) => (
        <tr key={row.key}><th scope="row">{row.label}</th><td>{row.value}</td></tr>
      ))}</tbody></table>
    </section>
  );
}
