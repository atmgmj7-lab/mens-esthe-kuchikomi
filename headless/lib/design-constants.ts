import type { AreaView } from "@/lib/wp/types";
import { OSAKA_CITY_IMAGES } from "@/lib/osaka-city-images";

export const COLORS = {
  navy: "#143d4d",
  gold: "#d4af37",
  turquoise: "#00a4a6"
} as const;

/** 店舗画像未設定時の4:3フォールバック */
export const DEFAULT_SHOP_IMAGE = "/images/eskomi-shop-fallback.svg";

export const AREA_HERO_IMAGES: Record<string, string> = {
  osaka: "/wp-content/uploads/2026/01/photo-1590559899731-a382839e5549.jpeg",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200",
  hyogo: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1200",
  nara: "https://images.unsplash.com/photo-1545569341-9eb1b6746a34?w=1200",
  shiga: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200",
  wakayama: "https://images.unsplash.com/photo-1494500764479-0c8a291d42e8?w=1200",
  nihonbashi: "/wp-content/uploads/2026/01/photo-1590559899731-a382839e5549.jpeg"
};

export const AREA_MAP_EMBED: Record<string, string> = {
  osaka: "https://www.google.com/maps?q=34.6937,135.5023&z=11&hl=ja&output=embed",
  hyogo: "https://www.google.com/maps?q=34.6901,135.1835&z=11&hl=ja&output=embed",
  kyoto: "https://www.google.com/maps?q=35.0116,135.7681&z=11&hl=ja&output=embed",
  nara: "https://www.google.com/maps?q=34.6851,135.8048&z=11&hl=ja&output=embed",
  shiga: "https://www.google.com/maps?q=35.0045,135.8686&z=11&hl=ja&output=embed",
  wakayama: "https://www.google.com/maps?q=34.2304,135.1706&z=11&hl=ja&output=embed"
};

export const KANSAI_AREAS = [
  { slug: "osaka", name: "大阪", en: "OSAKA", sub: "梅田・難波・心斎橋" },
  { slug: "kyoto", name: "京都", en: "KYOTO", sub: "河原町・四条・祇園" },
  { slug: "hyogo", name: "兵庫", en: "HYOGO", sub: "三宮・元町・西宮" },
  { slug: "nara", name: "奈良", en: "NARA", sub: "近鉄奈良・新大宮" },
  { slug: "shiga", name: "滋賀", en: "SHIGA", sub: "大津・草津" },
  { slug: "wakayama", name: "和歌山", en: "WAKAYAMA", sub: "和歌山駅・市駅" }
] as const;

export const KANSAI_TILE_IMAGES: Record<string, string> = {
  osaka: "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800",
  hyogo: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800",
  nara: "/wp-content/uploads/2026/01/d90bb876a73297001ed594f8d073d88c_t.jpeg",
  shiga: "/wp-content/uploads/2026/01/360_F_1174299064_3GAJ1DwZ6w3CNuPMgivzwakXMbLnDTBY.jpg",
  wakayama: "/wp-content/uploads/2026/01/34686f38a688c6f79b72935d06ea6593_t.jpeg"
};

export type AreaFeatureItem = {
  slug: string;
  href: string;
  subtitle: string;
  title: string;
  description: string;
  btnText: string;
  image: string;
  imageAlt: string;
};

export const AREA_FEATURES = [
  {
    slug: "sakaisujihonmachi",
    href: "/area/sakaisujihonmachi/",
    subtitle: "堺筋本町エリア特集",
    title: "堺筋本町メンズエステおすすめ一覧",
    description:
      "堺筋本町・本町・北浜周辺で探しやすい店舗を、料金・営業時間・アクセス・口コミの見方で比較できます。",
    btnText: "堺筋本町の店舗を見る",
    image: OSAKA_CITY_IMAGES.sakaisujiHommachiSenba,
    imageAlt: "堺筋本町・船場センタービル周辺の夜景"
  },
  {
    slug: "shinosaka",
    href: "/area/shinosaka/",
    subtitle: "新大阪エリア特集",
    title: "新大阪メンズエステおすすめ一覧",
    description:
      "新大阪・東三国・西中島南方周辺の候補を、出張前後や夜の利用もしやすい条件で比較できます。",
    btnText: "新大阪の店舗を見る",
    image: OSAKA_CITY_IMAGES.shinsaibashiStreet,
    imageAlt: "大阪の通り沿いの街並み"
  },
  {
    slug: "nihonbashi",
    href: "/area/nihonbashi/",
    subtitle: "日本橋エリア特集",
    title: "大阪日本橋メンズエステおすすめ一覧",
    description:
      "大阪・日本橋エリアのメンズエステを店舗一覧・口コミ・料金・営業時間・駅近・深夜営業で比較。初めての方にも選びやすいよう、編集部コメントと店舗情報をまとめています。",
    btnText: "日本橋の店舗を見る",
    image: OSAKA_CITY_IMAGES.dotonboriNight,
    imageAlt: "大阪日本橋周辺の夜の繁華街"
  },
  {
    slug: "umeda",
    href: "/area/umeda/",
    subtitle: "梅田エリア特集",
    title: "大阪梅田メンズエステおすすめ一覧",
    description:
      "梅田・大阪駅・東梅田・西梅田周辺の店舗を、駅近・深夜営業・料金目安で比較できます。",
    btnText: "梅田の店舗を見る",
    image: OSAKA_CITY_IMAGES.umedaStreetNight,
    imageAlt: "大阪梅田の夜の飲食街"
  },
  {
    slug: "sakai",
    href: "/area/sakai/",
    subtitle: "堺エリア特集",
    title: "堺メンズエステおすすめ一覧",
    description:
      "堺・堺東・三国ヶ丘周辺で探す方向けに、料金・営業時間・アクセスを見比べやすく整理しています。",
    btnText: "堺の店舗を見る",
    image: OSAKA_CITY_IMAGES.alley,
    imageAlt: "大阪の路地の街並み"
  }
] as const satisfies readonly AreaFeatureItem[];

export const AREA_FEATURE = AREA_FEATURES[0];

function areaFeatureCandidates(features: readonly AreaFeatureItem[] = []): AreaFeatureItem[] {
  const seen = new Set<string>();
  return [...features, ...AREA_FEATURES]
    .filter((feature) => feature.slug && feature.image)
    .filter((feature) => {
      if (seen.has(feature.slug)) return false;
      seen.add(feature.slug);
      return true;
    });
}

export function resolveAreaFeatureVisual(
  areaSlug: string,
  parentSlug?: string | null,
  features: readonly AreaFeatureItem[] = []
): { image: string; imageAlt: string } {
  const candidates = areaFeatureCandidates(features);
  const feature = candidates.find((item) => item.slug === areaSlug);
  if (feature) {
    return { image: feature.image, imageAlt: feature.imageAlt };
  }

  const parentFeature = parentSlug ? candidates.find((item) => item.slug === parentSlug) : null;
  if (parentFeature) {
    return { image: parentFeature.image, imageAlt: parentFeature.imageAlt };
  }

  return {
    image: AREA_HERO_IMAGES[areaSlug] || (parentSlug ? AREA_HERO_IMAGES[parentSlug] : "") || AREA_HERO_IMAGES.osaka,
    imageAlt: `${areaSlug}エリアの街並み`
  };
}

export function resolveAreaHeroImage(
  area: AreaView,
  parent?: AreaView | null,
  features: readonly AreaFeatureItem[] = []
): string {
  const featureVisual = resolveAreaFeatureVisual(area.slug, parent?.slug, features);
  return (
    featureVisual.image ||
    AREA_HERO_IMAGES[area.slug] ||
    (parent ? AREA_HERO_IMAGES[parent.slug] : "") ||
    AREA_HERO_IMAGES.osaka
  );
}

export function resolveMapEmbedUrl(area: AreaView): string {
  return AREA_MAP_EMBED[area.slug] || "";
}

export function areaTermBySlug(areas: AreaView[], slug: string): AreaView | undefined {
  return areas.find((a) => a.slug === slug);
}
