import Link from "next/link";
import { AreaShopCardImage } from "@/components/common/AreaShopCardImage";
import { PromotionDisclosureBadge } from "@/components/common/PromotionDisclosureBadge";
import { buildAreaShopCardViewModel } from "@/lib/area-shop-card-view-model";
import { buildAreaEditorialFeature } from "@/lib/area-editorial-featured";
import type { AreaView, ShopView } from "@/lib/wp/types";
import styles from "./AreaEditorialFeaturedShops.module.css";

export function AreaEditorialFeaturedShops({ area, shops }: {
  area: Pick<AreaView, "id" | "slug" | "name">;
  shops: readonly ShopView[];
}) {
  const feature = buildAreaEditorialFeature(area, shops);
  if (!feature) return null;
  return (
    <section id="area-editorial-featured" className={styles.section} aria-labelledby="area-editorial-featured-title">
      <h2 id="area-editorial-featured-title" className={styles.title}>{area.name}の{feature.config.label}</h2>
      <p className={styles.description}>{feature.config.description}</p>
      <ul className={styles.list}>
        {feature.shops.map((shop) => {
          const card = buildAreaShopCardViewModel(shop, area, { showRank: false });
          return (
            <li key={shop.id} data-editorial-featured-shop={shop.id}>
              <Link className={styles.card} href={card.title.href}>
                <span className={styles.image}><AreaShopCardImage {...card.image} /></span>
                <span className={styles.body}>
                  <span className={styles.name}>{card.title.text}</span>
                  {shop.ranking.promotion.requiresDisclosure ? <PromotionDisclosureBadge /> : null}
                  <span className={styles.cta}>店舗詳細を見る<span aria-hidden="true"> →</span></span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
