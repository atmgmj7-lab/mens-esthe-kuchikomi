import { ShopImageWithFallback } from "@/components/common/ShopImageWithFallback";
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
  return (
    <ShopImageWithFallback
      className={styles.image}
      fallbackClassName={styles.imageFallback}
      src={src}
      alt={alt}
      isFallback={isFallback}
      width={480}
      height={360}
      loading="lazy"
      decoding="async"
    />
  );
}
