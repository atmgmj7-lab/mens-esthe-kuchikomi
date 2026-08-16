"use client";

import { useState, type SyntheticEvent } from "react";
import {
  DEFAULT_SHOP_IMAGE,
  SHOP_FALLBACK_IMAGE_ALT,
  SHOP_FALLBACK_IMAGE_STYLE
} from "@/lib/design-constants";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

export const SHOP_DETAIL_FALLBACK_IMAGE_STYLE = {
  ...SHOP_FALLBACK_IMAGE_STYLE,
  aspectRatio: "1 / 1",
  height: "100%"
} as const;

export function replaceBrokenShopImage(
  event: SyntheticEvent<HTMLImageElement>,
  onFallback?: () => void
) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;

  image.dataset.fallbackApplied = "true";
  image.onerror = null;
  image.alt = SHOP_FALLBACK_IMAGE_ALT;
  image.src = DEFAULT_SHOP_IMAGE;
  Object.assign(image.style, SHOP_DETAIL_FALLBACK_IMAGE_STYLE);
  onFallback?.();
}

export function ShopDetailGallery({ model }: { model: ShopDetailViewModel }) {
  const mainImage = model.images[0];
  const [mainImageFallback, setMainImageFallback] = useState(mainImage.isFallback);

  return (
    <figure className={styles.gallery}>
      <div
        className={styles.mainImage}
        data-shop-card-square="true"
        data-media-role={mainImage.role}
        data-detail-banner="absent"
      >
        <img
          src={mainImage.url}
          alt={mainImageFallback ? SHOP_FALLBACK_IMAGE_ALT : mainImage.alt}
          width={mainImage.width ?? 960}
          height={mainImage.height ?? 960}
          sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1024px) 520px, 460px"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={(event) =>
            replaceBrokenShopImage(event, () => setMainImageFallback(true))
          }
          style={mainImageFallback ? SHOP_DETAIL_FALLBACK_IMAGE_STYLE : undefined}
        />
      </div>

      <figcaption>
        {mainImageFallback ? "店舗画像は準備中です。" : "店舗掲載画像"}
      </figcaption>
    </figure>
  );
}
