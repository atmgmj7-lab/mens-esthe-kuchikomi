import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import styles from "./ShopDetail.module.css";

export function ShopBasicInformationSection({
  model,
  rel
}: {
  model: ShopDetailViewModel;
  rel: string;
}) {
  const rows = model.infoRows.filter((row) => row.key !== "address" && row.key !== "station" && row.key !== "access");
  const hasAccessRows = model.infoRows.some((row) => row.key === "address" || row.key === "station" || row.key === "access");
  const shopSlug = normalizePublicShopSlug(model.slug);
  return (
    <section id="basic-information" className={styles.section}>
      {!hasAccessRows ? <span id="hours-access" className={styles.sectionAnchor} aria-hidden="true" /> : null}
      <div className={styles.sectionHeading}><p className={styles.kicker}>BASIC INFORMATION</p><h2>基本情報</h2></div>
      <dl className={styles.infoList}>{rows.map((row) => {
        const isOfficialLink = row.key === "official" && Boolean(row.href);
        return (
          <div key={row.key}><dt>{row.label}</dt><dd>{isOfficialLink ? (
            <a href={row.href} target="_blank" rel={rel} data-shop-cta-kind="official" data-shop-cta-position="info" data-shop-slug={shopSlug}>{row.value}</a>
          ) : row.value}</dd></div>
        );
      })}</dl>
      {model.verifiedAt ? <p className={styles.sourceNote}>掲載情報の確認日 {model.verifiedAt}</p> : null}
    </section>
  );
}
