"use client";

import {
  useState,
  type ComponentPropsWithoutRef,
  type SyntheticEvent
} from "react";
import {
  DEFAULT_SHOP_IMAGE,
  SHOP_FALLBACK_IMAGE_ALT,
  SHOP_FALLBACK_IMAGE_STYLE
} from "@/lib/design-constants";

type ShopImageWithFallbackProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "alt" | "onError"
> & {
  src?: string | null;
  alt: string;
  fallbackClassName?: string;
  isFallback?: boolean;
};

export function ShopImageWithFallback({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  isFallback = false,
  style,
  ...imageProps
}: ShopImageWithFallbackProps) {
  const [fallbackApplied, setFallbackApplied] = useState(isFallback || !src);
  const resolvedClassName = [
    className,
    fallbackApplied ? fallbackClassName : ""
  ]
    .filter(Boolean)
    .join(" ");

  const applyFallback = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;

    image.dataset.fallbackApplied = "true";
    image.onerror = null;
    image.alt = SHOP_FALLBACK_IMAGE_ALT;
    image.src = DEFAULT_SHOP_IMAGE;
    Object.assign(image.style, SHOP_FALLBACK_IMAGE_STYLE);
    if (fallbackClassName) image.classList.add(fallbackClassName);
    setFallbackApplied(true);
  };

  return (
    <img
      {...imageProps}
      className={resolvedClassName}
      src={fallbackApplied ? DEFAULT_SHOP_IMAGE : src ?? DEFAULT_SHOP_IMAGE}
      alt={fallbackApplied ? SHOP_FALLBACK_IMAGE_ALT : alt}
      data-fallback-applied={fallbackApplied ? "true" : undefined}
      onError={applyFallback}
      style={fallbackApplied ? { ...style, ...SHOP_FALLBACK_IMAGE_STYLE } : style}
    />
  );
}
