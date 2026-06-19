/**
 * テーマバナー設定（背景・装飾は CSS、女性ビジュアルは透過画像のみ）。
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

/** キャラクター透過画像のポーズ ID（public/images/area-hub/characters/{id}.webp） */
export type ThemeBannerCharacterPose =
  | "hero-waist-up-01"
  | "hero-uniform-gold-01"
  | "hero-black-dress-01"
  | "hero-braid-beige-01"
  | "hero-navy-uniform-01"
  | "hero-champagne-blouse-01"
  | "hero-champagne-clean-01";

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

const CHARACTER_BASE = "/images/area-hub/characters";

export function characterImageSrc(pose: ThemeBannerCharacterPose): string {
  return `${CHARACTER_BASE}/${pose}.webp`;
}

export const THEME_BANNER_STYLES: Record<ThemeBannerKey, ThemeBannerThemeStyle> = {
  areaHero: {
    themeKey: "areaHero",
    cssClass: "theme-banner--area-hero",
    defaultLabel: "AREA FEATURE",
    size: "hero",
    characterAlign: "right",
    decorativeIntensity: "rich",
    defaultCharacterPose: "hero-waist-up-01"
  },
  ranking: {
    themeKey: "ranking",
    cssClass: "theme-banner--ranking",
    defaultLabel: "RANKING",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: "hero-uniform-gold-01"
  },
  price: {
    themeKey: "price",
    cssClass: "theme-banner--price",
    defaultLabel: "PRICE",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: "hero-navy-uniform-01"
  },
  lateNight: {
    themeKey: "lateNight",
    cssClass: "theme-banner--late-night",
    defaultLabel: "LATE NIGHT",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: "hero-black-dress-01"
  },
  beginner: {
    themeKey: "beginner",
    cssClass: "theme-banner--beginner",
    defaultLabel: "BEGINNER",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: "hero-braid-beige-01"
  },
  station: {
    themeKey: "station",
    cssClass: "theme-banner--station",
    defaultLabel: "ACCESS",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: "hero-navy-uniform-01"
  },
  reviews: {
    themeKey: "reviews",
    cssClass: "theme-banner--reviews",
    defaultLabel: "REVIEWS",
    size: "section",
    characterAlign: "right",
    decorativeIntensity: "normal",
    defaultCharacterPose: "hero-champagne-blouse-01"
  },
  guide: {
    themeKey: "guide",
    cssClass: "theme-banner--guide",
    defaultLabel: "GUIDE",
    size: "compact",
    characterAlign: "right",
    decorativeIntensity: "light",
    defaultCharacterPose: "hero-braid-beige-01"
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
  imagePose: ThemeBannerCharacterPose;
  imageAlt: string;
};

const DEFAULT_AREA_HERO_BANNER: AreaHeroBannerConfig = {
  message: "エリアで自分に合うメンズエステを見つける",
  imagePose: "hero-waist-up-01",
  imageAlt: "メンズエステを案内するイメージ"
};

/** areaHero 専用：1メッセージ + 1画像 */
export const AREA_HERO_BANNER_OVERRIDES: Record<string, Partial<AreaHeroBannerConfig>> = {
  nihonbashi: {
    message: "日本橋で自分に合うメンズエステを見つける",
    imagePose: "hero-champagne-clean-01",
    imageAlt: "日本橋エリアのメンズエステを案内するイメージ"
  },
  nanba: {
    message: "難波で自分に合うメンズエステを見つける",
    imagePose: "hero-champagne-clean-01",
    imageAlt: "難波エリアのメンズエステを案内するイメージ"
  },
  umeda: {
    message: "梅田で自分に合うメンズエステを見つける",
    imagePose: "hero-champagne-clean-01",
    imageAlt: "梅田エリアのメンズエステを案内するイメージ"
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
    imageSrc: characterImageSrc(config.imagePose),
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
