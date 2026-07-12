import { OSAKA_CITY_IMAGES } from "@/lib/osaka-city-images";

export type HomeFeatureBannerConfig = {
  eyebrow: string;
  title: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  pcImage: string;
  spImage: string;
};

export const HOME_NIHONBASHI_FEATURE_BANNER: HomeFeatureBannerConfig = {
  eyebrow: "AREA FEATURE",
  title: "大阪日本橋メンズエステ特集",
  lead: "口コミ・料金・営業時間で比較できる日本橋エリアの店舗一覧。",
  ctaLabel: "日本橋特集を見る",
  ctaHref: "/area/nihonbashi/",
  pcImage: OSAKA_CITY_IMAGES.nambaStreet,
  spImage: OSAKA_CITY_IMAGES.neonStreet
};
