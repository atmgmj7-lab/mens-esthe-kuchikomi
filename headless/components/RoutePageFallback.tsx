type RoutePageFallbackVariant = "area" | "shops-list" | "shop-detail" | "static" | "column";

const VARIANTS: Record<
  RoutePageFallbackVariant,
  { className: string; id: string; innerClassName: string }
> = {
  area: {
    className: "l-main_content l-article hl-area-page hl-route-fallback",
    id: "main_content",
    innerClassName: "l-main_content__inner"
  },
  "shops-list": {
    className: "l-main_content l-article hl-shops-page hl-route-fallback",
    id: "main_content",
    innerClassName: "l-main_content__inner"
  },
  "shop-detail": {
    className: "l-mainContent l-article hl-shop-page hl-route-fallback",
    id: "main_content",
    innerClassName: "l-mainContent__inner"
  },
  static: {
    className: "l-mainContent hl-static-page hl-route-fallback",
    id: "main_content",
    innerClassName: "mep-container hl-static-page-inner"
  },
  column: {
    className: "l-mainContent l-article hl-route-fallback",
    id: "main_content",
    innerClassName: "l-mainContent__inner"
  }
};

export function RoutePageFallback({ variant }: { variant: RoutePageFallbackVariant }) {
  const { className, id, innerClassName } = VARIANTS[variant];

  return (
    <main id={id} className={className} aria-busy="true" aria-label="読み込み中">
      <div className={innerClassName}>
        <span className="hl-route-fallback__spacer" aria-hidden="true" />
      </div>
    </main>
  );
}
