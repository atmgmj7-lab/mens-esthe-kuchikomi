import { safeText, stripHtml } from "@/lib/wp/client";

export type AreaContentConfig = {
  slug: string;
  displayName: string;
  canonicalName: string;
  prefecture: string;
  city?: string;
  stationNames: string[];
  allowedPlaceNames: string[];
  forbiddenPlaceNames: string[];
  fallbackLead: string;
};

const COMMON_OSAKA_TERMS = ["大阪", "大阪府", "関西"];

export const AREA_CONTENT_CONFIGS: AreaContentConfig[] = [
  {
    slug: "sakaisujihonmachi",
    displayName: "堺筋本町",
    canonicalName: "堺筋本町",
    prefecture: "大阪府",
    city: "大阪市中央区",
    stationNames: ["堺筋本町駅", "本町駅", "北浜駅", "長堀橋駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "堺筋本町", "本町", "北浜", "長堀橋", "中央区"],
    forbiddenPlaceNames: ["新大阪駅周辺", "堺東駅", "梅田駅周辺", "近鉄日本橋駅周辺"],
    fallbackLead: "堺筋本町エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "nihonbashi",
    displayName: "日本橋",
    canonicalName: "大阪日本橋",
    prefecture: "大阪府",
    city: "大阪市中央区",
    stationNames: ["近鉄日本橋駅", "日本橋駅", "なんば駅", "難波駅", "谷町九丁目駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "日本橋", "大阪日本橋", "近鉄日本橋", "なんば", "難波", "谷町九丁目", "黒門市場"],
    forbiddenPlaceNames: ["新大阪駅周辺", "堺東駅", "梅田駅周辺"],
    fallbackLead: "日本橋エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "shinosaka",
    displayName: "新大阪",
    canonicalName: "新大阪",
    prefecture: "大阪府",
    city: "大阪市淀川区",
    stationNames: ["新大阪駅", "東三国駅", "西中島南方駅", "南方駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "新大阪", "東三国", "西中島南方", "南方", "淀川区"],
    forbiddenPlaceNames: ["近鉄日本橋", "日本橋駅", "大阪日本橋", "谷町九丁目", "黒門市場", "堺東駅", "梅田駅"],
    fallbackLead: "新大阪エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "sakai",
    displayName: "堺",
    canonicalName: "堺",
    prefecture: "大阪府",
    city: "堺市",
    stationNames: ["堺駅", "堺東駅", "三国ヶ丘駅", "大小路駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "堺", "堺市", "堺東", "三国ヶ丘", "大小路"],
    forbiddenPlaceNames: ["梅田駅", "新大阪駅", "近鉄日本橋", "日本橋駅周辺", "谷町九丁目"],
    fallbackLead: "堺エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "sakai-higashi",
    displayName: "堺東",
    canonicalName: "堺東",
    prefecture: "大阪府",
    city: "堺市",
    stationNames: ["堺東駅", "堺駅", "三国ヶ丘駅", "大小路駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "堺東", "堺", "堺市", "三国ヶ丘", "大小路"],
    forbiddenPlaceNames: ["梅田駅", "新大阪駅", "近鉄日本橋", "日本橋駅周辺", "谷町九丁目"],
    fallbackLead: "堺東エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "sakaihigashi",
    displayName: "堺東",
    canonicalName: "堺東",
    prefecture: "大阪府",
    city: "堺市",
    stationNames: ["堺東駅", "堺駅", "三国ヶ丘駅", "大小路駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "堺東", "堺", "堺市", "三国ヶ丘", "大小路"],
    forbiddenPlaceNames: ["梅田駅", "新大阪駅", "近鉄日本橋", "日本橋駅周辺", "谷町九丁目"],
    fallbackLead: "堺東エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "umeda",
    displayName: "梅田",
    canonicalName: "梅田",
    prefecture: "大阪府",
    city: "大阪市北区",
    stationNames: ["梅田駅", "大阪駅", "東梅田駅", "西梅田駅", "北新地駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "梅田", "大阪駅", "東梅田", "西梅田", "北新地", "北区"],
    forbiddenPlaceNames: ["新大阪駅周辺", "堺東駅周辺", "谷町九丁目駅周辺"],
    fallbackLead: "梅田エリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
  {
    slug: "nanba",
    displayName: "なんば",
    canonicalName: "なんば",
    prefecture: "大阪府",
    city: "大阪市中央区",
    stationNames: ["なんば駅", "難波駅", "大阪難波駅", "近鉄日本橋駅"],
    allowedPlaceNames: [...COMMON_OSAKA_TERMS, "なんば", "難波", "大阪難波", "日本橋", "近鉄日本橋", "中央区"],
    forbiddenPlaceNames: ["新大阪駅周辺", "堺東駅周辺", "梅田駅周辺"],
    fallbackLead: "なんばエリアの掲載店舗について、料金・営業時間・アクセス・口コミを確認できます。",
  },
];

const AREA_CONTENT_CONFIG_BY_SLUG = new Map(AREA_CONTENT_CONFIGS.map((config) => [config.slug, config]));

export function getAreaContentConfig(slug?: string | null): AreaContentConfig | undefined {
  if (!slug) {
    return undefined;
  }

  return AREA_CONTENT_CONFIG_BY_SLUG.get(slug);
}

export function getAreaStationNames(slug?: string | null): string[] {
  return getAreaContentConfig(slug)?.stationNames ?? [];
}

export function findForbiddenPlaceNames(slug: string | undefined, value: unknown): string[] {
  const config = getAreaContentConfig(slug);
  if (!config) {
    return [];
  }

  const normalizedText = stripHtml(safeText(value));
  if (!normalizedText) {
    return [];
  }

  return config.forbiddenPlaceNames.filter((placeName) => normalizedText.includes(placeName));
}

export function hasForbiddenPlaceName(slug: string | undefined, value: unknown): boolean {
  return findForbiddenPlaceNames(slug, value).length > 0;
}

export function sanitizeAreaText(slug: string | undefined, value: unknown, fallback = ""): string {
  const text = stripHtml(safeText(value));
  if (!text) {
    return fallback;
  }

  if (hasForbiddenPlaceName(slug, text)) {
    return fallback || getAreaContentConfig(slug)?.fallbackLead || "";
  }

  return text;
}

export function sanitizeAreaHtml(slug: string | undefined, value: unknown, fallback = ""): string {
  const html = safeText(value);
  if (!html) {
    return fallback;
  }

  if (hasForbiddenPlaceName(slug, html)) {
    return fallback || getAreaContentConfig(slug)?.fallbackLead || "";
  }

  return html;
}

type AreaFaqLike = {
  question?: string;
  answer?: string;
  q?: string;
  a?: string;
};

export function filterAreaFaqRows<T extends AreaFaqLike>(slug: string | undefined, rows: T[]): T[] {
  return rows.filter((row) => {
    const question = row.question ?? row.q ?? "";
    const answer = row.answer ?? row.a ?? "";
    return !hasForbiddenPlaceName(slug, `${question}\n${answer}`);
  });
}
