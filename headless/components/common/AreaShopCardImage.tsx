"use client";

import { useState } from "react";
import { replaceBrokenShopImage } from "@/components/shop-detail/ShopDetailGallery";
import {
  DEFAULT_SHOP_IMAGE,
  SHOP_FALLBACK_IMAGE_ALT,
  SHOP_FALLBACK_IMAGE_STYLE
} from "@/lib/design-constants";
import styles from "./AreaShopCard.module.css";

type AreaShopCardImageProps = {
  src: string;
  alt: string;
  isFallback: boolean;
};

export function AreaShopCardImage({
  src,
  alt,
  isFallback
}: AreaShopCardImageProps) {
  const [fallbackApplied, setFallbackApplied] = useState(isFallback);

  return (
    <img
      className={[styles.image, fallbackApplied ? styles.imageFallback : ""]
        .filter(Boolean)
        .join(" ")}
      src={fallbackApplied ? DEFAULT_SHOP_IMAGE : src}
      alt={fallbackApplied ? SHOP_FALLBACK_IMAGE_ALT : alt}
      width={480}
      height={360}
      loading="lazy"
      decoding="async"
      data-fallback-applied={fallbackApplied ? "true" : undefined}
      onError={(event) =>
        replaceBrokenShopImage(event, () => {
          event.currentTarget.classList.add(styles.imageFallback);
          setFallbackApplied(true);
        })
      }
      style={fallbackApplied ? SHOP_FALLBACK_IMAGE_STYLE : undefined}
    />
  );
}
