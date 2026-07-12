import { OSAKA_CITY_IMAGES } from "@/lib/osaka-city-images";

/**
 * エリアトップ用タイトルバナー（PC/SP別背景画像 + HTMLテキスト）。
 * 対象エリアのみ設定を追加して展開する。
 */

export type AreaTitleBannerConfig = {
  eyebrow: string;
  /** 改行は \n */
  title: string;
  lead: string;
  pcImage: string;
  spImage: string;
};

export const AREA_TITLE_BANNERS: Record<string, AreaTitleBannerConfig> = {
  nihonbashi: {
    eyebrow: "AREA FEATURE",
    title: "日本橋で、自分に合う\nメンズエステを見つける",
    lead: "口コミ・料金・営業時間で比較",
    pcImage: OSAKA_CITY_IMAGES.nambaStreet,
    spImage: OSAKA_CITY_IMAGES.neonStreet
  }
};

export function resolveAreaTitleBanner(areaSlug: string): AreaTitleBannerConfig | null {
  return AREA_TITLE_BANNERS[areaSlug] ?? null;
}

export function hasAreaTitleBanner(areaSlug: string): boolean {
  return areaSlug in AREA_TITLE_BANNERS;
}
