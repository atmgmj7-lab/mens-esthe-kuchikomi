/**
 * テーマバナー設定（背景・装飾は CSS、画像は使わない）。
 * 文言はコンポーネント props / ハブ SEO 設定から渡す。
 */

export type ThemeBannerKey =
  | "areaHero"
  | "ranking"
  | "price"
  | "lateNight"
  | "beginner"
  | "station"
  | "reviews"
  | "guide"
  | "faq";

export type ThemeBannerCharacterPose = never;

export type ThemeBannerSize = "hero" | "section" | "compact";

export type ThemeBannerAlign = "right" | "left";

export type ThemeBannerThemeStyle = {
  themeKey: ThemeBannerKey;
  cssClass: string;
  defaultLabel: string;
  size: ThemeBannerSize;
  characterAlign: ThemeBannerAlign;
  decorativeIntensity: "rich" | "normal" | "light";
  defaultCharacterPose: ThemeBannerCharacterPose | null;
};

export function characterImageSrc(pose: ThemeBannerCharacterPose): string {
  return pose;
}

export const THEME_BANNER_STYLES: Record<ThemeBannerKey, ThemeBannerThemeStyle> = {
  areaHero: {
    themeKey: "areaHero",
    cssClass: "theme-banner--area-hero",
    defaultLabel: "AREA FEATURE",
    size: "hero",
    characterAlign: "right",
    decorativeIntensity: "rich",
    defaultCharacterPose: null
  },
  ranking: {
    themeKey: "ranking",
    cssClass: "theme-banner--ranking",
    defaultLabel: "RANKING",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: null
  },
  price: {
    themeKey: "price",
    cssClass: "theme-banner--price",
    defaultLabel: "PRICE",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: null
  },
  lateNight: {
    themeKey: "lateNight",
    cssClass: "theme-banner--late-night",
    defaultLabel: "LATE NIGHT",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: null
  },
  beginner: {
    themeKey: "beginner",
    cssClass: "theme-banner--beginner",
    defaultLabel: "BEGINNER",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: null
  },
  station: {
    themeKey: "station",
    cssClass: "theme-banner--station",
    defaultLabel: "ACCESS",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: null
  },
  reviews: {
    themeKey: "reviews",
    cssClass: "theme-banner--reviews",
    defaultLabel: "REVIEWS",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: null
  },
  guide: {
    themeKey: "guide",
    cssClass: "theme-banner--guide",
    defaultLabel: "GUIDE",
    size: "compact",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: null
  },
  faq: {
    themeKey: "faq",
    cssClass: "theme-banner--faq",
    defaultLabel: "FAQ",
    size: "compact",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: null
  }
};

/** area slug → theme → キャラクターポーズ上書き */
export const THEME_BANNER_CHARACTER_OVERRIDES: Record<
  string,
  Partial<Record<ThemeBannerKey, ThemeBannerCharacterPose | null>>
> = {
  nihonbashi: {},
  nanba: {},
  umeda: {}
};

export type AreaHeroBannerConfig = {
  message: string;
  imagePose: ThemeBannerCharacterPose | null;
  imageAlt: string;
};

const DEFAULT_AREA_HERO_BANNER: AreaHeroBannerConfig = {
  message: "エリアで自分に合うメンズエステを見つける",
  imagePose: null,
  imageAlt: ""
};

/** areaHero 専用：1メッセージ + 1画像 */
export const AREA_HERO_BANNER_OVERRIDES: Record<string, Partial<AreaHeroBannerConfig>> = {
  nihonbashi: {
    message: "日本橋で自分に合うメンズエステを見つける",
    imagePose: null,
    imageAlt: ""
  },
  nanba: {
    message: "難波で自分に合うメンズエステを見つける",
    imagePose: null,
    imageAlt: ""
  },
  umeda: {
    message: "梅田で自分に合うメンズエステを見つける",
    imagePose: null,
    imageAlt: ""
  }
};

export function resolveAreaHeroBanner(areaSlug: string): {
  message: string;
  imageSrc: string;
  imageAlt: string;
} {
  const config = { ...DEFAULT_AREA_HERO_BANNER, ...AREA_HERO_BANNER_OVERRIDES[areaSlug] };
  return {
    message: config.message,
    imageSrc: config.imagePose ? characterImageSrc(config.imagePose) : "",
    imageAlt: config.imageAlt
  };
}

export function resolveThemeBannerCharacter(
  areaSlug: string,
  themeKey: ThemeBannerKey
): string | null {
  const style = THEME_BANNER_STYLES[themeKey];
  const override = THEME_BANNER_CHARACTER_OVERRIDES[areaSlug]?.[themeKey];
  const pose =
    override !== undefined ? override : style.defaultCharacterPose;
  return pose ? characterImageSrc(pose) : null;
}

export function getThemeBannerStyle(themeKey: ThemeBannerKey): ThemeBannerThemeStyle {
  return THEME_BANNER_STYLES[themeKey];
}

/** AreaHubThemeKey → ThemeBannerKey */
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

const HUB_TO_BANNER: Partial<Record<AreaHubThemeKey, ThemeBannerKey>> = {
  hero: "areaHero",
  ranking: "ranking",
  price: "price",
  "late-night": "lateNight",
  beginner: "beginner",
  station: "station",
  reviews: "reviews",
  guide: "guide",
  faq: "faq"
};


/** レイヤード ThemeBanner を使うタブ（CompareTabPanel）。順次追加: ranking, lateNight, reviews */
/** CompareTabPanel 内タブで ThemeBanner を使うテーマ（areaHero 以外は当面 OFF） */
export const LAYERED_BANNER_TABS: ReadonlySet<ThemeBannerKey> = new Set([
  // 展開例: "beginner", "lateNight", "price", "station"
]);

/** ページセクション（ranking / reviews 等）で ThemeBanner を使うテーマ */
export const LAYERED_BANNER_SECTIONS: ReadonlySet<ThemeBannerKey> = new Set([
  // 展開例: "ranking", "reviews"
]);

export function isLayeredBannerTabEnabled(themeKey: ThemeBannerKey): boolean {
  return LAYERED_BANNER_TABS.has(themeKey);
}

/** @deprecated Use isLayeredBannerTabEnabled */
export function isLayeredBannerEnabled(themeKey: ThemeBannerKey): boolean {
  return isLayeredBannerTabEnabled(themeKey);
}

export function isLayeredBannerSectionEnabled(themeKey: ThemeBannerKey): boolean {
  return LAYERED_BANNER_SECTIONS.has(themeKey);
}

export function mapHubThemeToBannerKey(
  hubTheme: AreaHubThemeKey
): ThemeBannerKey | null {
  return HUB_TO_BANNER[hubTheme] ?? null;
}
