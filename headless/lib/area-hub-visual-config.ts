/**
 * エリアハブ各セクションのビジュアル設定（画像キー・背景テーマ）。
 * エリア差分は overrides のみ。画像は public/images/area-hub/ に配置して差し替え可能。
 */

export type AreaHubThemeKey =
  | "hero"
  | "ranking"
  | "shop-list"
  | "price"
  | "late-night"
  | "beginner"
  | "station"
  | "reviews"
  | "market"
  | "guide"
  | "faq"
  | "official";

export type AreaHubIconName =
  | "ranking"
  | "price"
  | "late-night"
  | "beginner"
  | "station"
  | "reviews"
  | "guide"
  | "faq"
  | "official"
  | "shop-list"
  | "market"
  | "hero";

export type AreaHubThemeVisual = {
  key: AreaHubThemeKey;
  enLabel: string;
  icon: AreaHubIconName;
  /** public 配下パスまたは絶対URL。null でバナー非表示 */
  bannerImage: string | null;
  backgroundClass: string;
};

type ThemeVisualBase = Omit<AreaHubThemeVisual, "key">;

const IMAGE_BASE = "/images/area-hub";

export const DEFAULT_AREA_HUB_THEME_VISUALS: Record<AreaHubThemeKey, ThemeVisualBase> = {
  hero: {
    enLabel: "AREA FEATURE",
    icon: "hero",
    bannerImage: null,
    backgroundClass: "area-hub-theme--hero"
  },
  ranking: {
    enLabel: "RANKING",
    icon: "ranking",
    bannerImage: null,
    backgroundClass: "area-hub-theme--ranking"
  },
  "shop-list": {
    enLabel: "SHOP LIST",
    icon: "shop-list",
    bannerImage: null,
    backgroundClass: "area-hub-theme--shop-list"
  },
  price: {
    enLabel: "PRICE",
    icon: "price",
    bannerImage: null,
    backgroundClass: "area-hub-theme--price"
  },
  "late-night": {
    enLabel: "LATE NIGHT",
    icon: "late-night",
    bannerImage: null,
    backgroundClass: "area-hub-theme--late-night"
  },
  beginner: {
    enLabel: "BEGINNER",
    icon: "beginner",
    bannerImage: null,
    backgroundClass: "area-hub-theme--beginner"
  },
  station: {
    enLabel: "ACCESS",
    icon: "station",
    bannerImage: null,
    backgroundClass: "area-hub-theme--station"
  },
  reviews: {
    enLabel: "REVIEWS",
    icon: "reviews",
    bannerImage: null,
    backgroundClass: "area-hub-theme--reviews"
  },
  market: {
    enLabel: "MARKET",
    icon: "market",
    bannerImage: null,
    backgroundClass: "area-hub-theme--market"
  },
  guide: {
    enLabel: "GUIDE",
    icon: "guide",
    bannerImage: null,
    backgroundClass: "area-hub-theme--guide"
  },
  faq: {
    enLabel: "FAQ",
    icon: "faq",
    bannerImage: null,
    backgroundClass: "area-hub-theme--faq"
  },
  official: {
    enLabel: "OFFICIAL",
    icon: "official",
    bannerImage: null,
    backgroundClass: "area-hub-theme--official"
  }
};

/** エリア slug → テーマキー → 部分上書き（bannerImage など） */
export const AREA_HUB_VISUAL_OVERRIDES: Record<
  string,
  Partial<Record<AreaHubThemeKey, Partial<ThemeVisualBase>>>
> = {
  nihonbashi: {},
  nanba: {},
  umeda: {}
};

export function getAreaHubThemeVisual(
  areaSlug: string,
  theme: AreaHubThemeKey
): AreaHubThemeVisual {
  const base = DEFAULT_AREA_HUB_THEME_VISUALS[theme];
  const override = AREA_HUB_VISUAL_OVERRIDES[areaSlug]?.[theme] ?? {};
  return {
    key: theme,
    ...base,
    ...override
  };
}

export function getAreaHubHeroVisual(areaSlug: string): AreaHubThemeVisual {
  return getAreaHubThemeVisual(areaSlug, "hero");
}
