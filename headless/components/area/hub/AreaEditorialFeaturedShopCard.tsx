"use client";

import Link from "next/link";
import { AreaShopComparisonToggle } from "@/components/area/comparison/AreaShopComparisonExperience";
import { AreaShopCardImage } from "@/components/common/AreaShopCardImage";
import { PromotionDisclosureBadge } from "@/components/common/PromotionDisclosureBadge";
import type { AreaShopCardViewModel } from "@/lib/area-shop-card-view-model";
import styles from "./AreaEditorialFeaturedShops.module.css";

export function AreaEditorialFeaturedShopCard({
  shopId,
  card,
  requiresDisclosure,
}: {
  shopId: number;
  card: AreaShopCardViewModel;
  requiresDisclosure: boolean;
}) {
  return (
    <li data-editorial-featured-shop={shopId} className={styles.item}>
      <Link className={styles.card} href={card.title.href}>
        <span className={styles.image}><AreaShopCardImage {...card.image} /></span>
        <span className={styles.body}>
          <span className={styles.name}>{card.title.text}</span>
          {requiresDisclosure ? <PromotionDisclosureBadge /> : null}
          <span className={styles.cta}>店舗詳細を見る<span aria-hidden="true"> →</span></span>
        </span>
      </Link>
      <AreaShopComparisonToggle shopId={shopId} location="featured" className={styles.compare} />
    </li>
  );
}
