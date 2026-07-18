import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export function ShopFeaturesSection({ model }: { model: ShopDetailViewModel }) {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.sectionHeading}><p className={styles.kicker}>FEATURES</p><h2>こだわり・特徴</h2></div>
      <ul className={styles.features}>{model.featureNames.map((name) => <li key={name}>{name}</li>)}</ul>
    </section>
  );
}
