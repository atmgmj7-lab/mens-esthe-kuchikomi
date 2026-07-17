"use client";

import { useState, type SyntheticEvent } from "react";
import {
  DEFAULT_SHOP_IMAGE,
  SHOP_FALLBACK_IMAGE_ALT,
  SHOP_FALLBACK_IMAGE_STYLE
} from "@/lib/design-constants";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import styles from "./ShopDetail.module.css";

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
  Object.assign(image.style, SHOP_FALLBACK_IMAGE_STYLE);
  onFallback?.();
}

export function ShopDetailGallery({ model }: { model: ShopDetailViewModel }) {
  const mainImage = model.images[0];
  const [mainImageFallback, setMainImageFallback] = useState(mainImage.isFallback);

  return (
    <figure className={styles.gallery}>
      <div className={styles.mainImage}>
        <img
          src={mainImage.url}
          alt={mainImageFallback ? SHOP_FALLBACK_IMAGE_ALT : mainImage.alt}
          width={960}
          height={720}
          sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 112px), (max-width: 1024px) calc(100vw - 128px), (max-width: 1440px) calc(100vw - 480px), 960px"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={(event) =>
            replaceBrokenShopImage(event, () => setMainImageFallback(true))
          }
          style={mainImageFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}
        />
      </div>

      {model.images.length > 1 ? (
        <div className={styles.thumbnails}>
          {model.images.slice(1).map((image) => (
            <div className={styles.thumbnail} key={image.url}>
              <img
                src={image.url}
                alt={image.isFallback ? SHOP_FALLBACK_IMAGE_ALT : image.alt}
                width={240}
                height={180}
                loading="lazy"
                sizes="(max-width: 760px) calc((100vw - 48px) / 3), (max-width: 768px) calc((100vw - 128px) / 3), (max-width: 1024px) calc((100vw - 144px) / 3), (max-width: 1440px) calc((100vw - 496px) / 3), calc((960px - 16px) / 3)"
                decoding="async"
                onError={replaceBrokenShopImage}
                style={image.isFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}
              />
            </div>
          ))}
        </div>
      ) : null}

      <figcaption>
        {mainImageFallback ? "店舗画像は準備中です。" : "店舗掲載画像"}
      </figcaption>
    </figure>
  );
}
