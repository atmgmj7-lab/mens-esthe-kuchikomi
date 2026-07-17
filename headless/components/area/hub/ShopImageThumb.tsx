import { ShopImageWithFallback } from "@/components/common/ShopImageWithFallback";

type ThumbSize = "card" | "compact" | "table";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  size?: ThumbSize;
  width?: number;
  height?: number;
  priority?: boolean;
};

export function ShopImageThumb({
  src,
  alt,
  className = "",
  size = "card",
  width = 320,
  height = 213,
  priority = false
}: Props) {
  const hasImage = Boolean(src);
  const imageHeight = hasImage ? height : Math.round(width * 0.75);
  const sizeClass =
    size === "compact"
      ? "shop-image-thumb--compact"
      : size === "table"
        ? "shop-image-thumb--table"
        : "shop-image-thumb--card";

  return (
    <div
      className={`shop-image-thumb ${sizeClass} ${hasImage ? "" : "shop-image-thumb--placeholder"} ${className}`.trim()}
    >
      <ShopImageWithFallback
        src={src}
        alt={alt}
        width={width}
        height={imageHeight}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="shop-image-thumb__img"
      />
      {!hasImage ? <span className="shop-image-thumb__badge">Eskomi</span> : null}
    </div>
  );
}
