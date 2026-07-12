import { OSAKA_CITY_IMAGES } from "@/lib/osaka-city-images";

export type HomeHeroCta = {
  label: string;
  href: string;
  variant?: "primary" | "outline";
  /** SPでは非表示（最大2CTA用） */
  mobileHidden?: boolean;
};

export type HomeHeroConfig = {
  eyebrow: string;
  /** 改行は \n */
  title: string;
  lead: string;
  pcImage: string;
  spImage: string;
  ctas: HomeHeroCta[];
};

export const HOME_HERO_CONFIG: HomeHeroConfig = {
  eyebrow: "ESCOMI GUIDE",
  title: "関西メンズエステを\n口コミ・料金・エリアで探す",
  lead: "大阪・日本橋・難波・梅田など、目的に合う店舗を比較できます。",
  pcImage: OSAKA_CITY_IMAGES.cityscape,
  spImage: OSAKA_CITY_IMAGES.nambaStreet,
  ctas: [
    { label: "大阪エリアを見る", href: "/area/osaka/", variant: "primary" },
    { label: "日本橋特集を見る", href: "/area/nihonbashi/", variant: "outline" },
    {
      label: "口コミを書く",
      href: "/reviews/submit/",
      variant: "outline",
      mobileHidden: true
    }
  ]
};
