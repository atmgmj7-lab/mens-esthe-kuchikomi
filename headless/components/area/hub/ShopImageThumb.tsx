import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";

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
  const imageSrc = src || DEFAULT_SHOP_IMAGE;
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
      <img
        src={imageSrc}
        alt={hasImage ? alt : "Eskomi 店舗画像準備中"}
        width={width}
        height={imageHeight}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="shop-image-thumb__img"
        style={hasImage ? undefined : { aspectRatio: "4 / 3", objectFit: "contain" }}
      />
      {!hasImage ? <span className="shop-image-thumb__badge">Eskomi</span> : null}
    </div>
  );
}
