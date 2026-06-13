import { safeText } from "@/lib/wp/client";
import type { ShopView } from "@/lib/wp/types";

const PRICE_KEYS = [
  "shop_price_60min",
  "price_60",
  "price_50",
  "price_70",
  "price_80",
  "price_90",
  "price_120",
  "price_150",
  "basic_price"
] as const;

/** 梅田・本町等より優先する日本橋徒歩圏の明示パターン */
const NIHONBASHI_CORE_PRIORITY_PATTERN =
  /近鉄日本橋|なんば|難波|谷町九丁目|黒門市場|黒門|千日前|日本橋[1-5１-５](?:[-‐−－]?\d)?丁目|日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏|日本橋/;
const NEARBY_AREA_PATTERN = /堺筋本町|本町|梅田|西中島|天王寺|心斎橋|道頓堀/;
const CORE_STATION_PATTERN =
  /日本橋|近鉄日本橋|なんば|難波|谷町九丁目|黒門|千日前/;

function buildLocationHaystack(shop: ShopView): string {
  const address = safeText(shop.acf.shop_address);
  const area = shopAreaLabel(shop);
  return `${address}${area}`;
}

/** 複数拠点住所でも日本橋徒歩圏の記載を最優先で判定 */
function hasNihonbashiCoreIndicator(text: string): boolean {
  return NIHONBASHI_CORE_PRIORITY_PATTERN.test(text);
}

export type NihonbashiLocationTier = "core" | "nearby" | "related";

export const NIHONBASHI_HUB_TITLE =
  "大阪日本橋メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較";

export const NIHONBASHI_HUB_DESCRIPTION =
  "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステを店舗一覧、口コミ、料金、営業時間、アクセスで比較。深夜営業、駅近、初心者向け、料金目安、編集部コメントをもとに日本橋エリアの候補店舗を探せます。";

export const NIHONBASHI_GUIDE_TITLE =
  "日本橋メンズエステで失敗しない選び方｜料金相場・口コミの見方を解説";

export const NIHONBASHI_GUIDE_DESCRIPTION =
  "大阪日本橋・近鉄日本橋周辺でメンズエステを選ぶときのポイントを解説。料金相場、口コミの見方、営業時間、深夜営業、初心者が注意すべき点を整理し、店舗一覧・ランキングページへの導線も掲載しています。";

export function isNihonbashiShop(shop: ShopView): boolean {
  if (shop.areaSlug === "nihonbashi") return true;
  return shop.terms.some(
    (t) => t.slug === "nihonbashi" || t.name.includes("日本橋")
  );
}

export function shopAreaLabel(shop: ShopView): string {
  const areaTerm = shop.terms.find((t) => t.parent !== 0) || shop.terms[0];
  return areaTerm?.name || "日本橋";
}

export function classifyNihonbashiLocation(shop: ShopView): NihonbashiLocationTier {
  const haystack = buildLocationHaystack(shop);

  if (hasNihonbashiCoreIndicator(haystack)) {
    return "core";
  }
  if (NEARBY_AREA_PATTERN.test(haystack)) {
    return "nearby";
  }
  return "related";
}

export function resolveNihonbashiRelation(shop: ShopView): string {
  const haystack = buildLocationHaystack(shop);
  const area = shopAreaLabel(shop);

  if (hasNihonbashiCoreIndicator(haystack)) {
    if (/近鉄日本橋/.test(haystack)) {
      return "近鉄日本橋駅徒歩圏（日本橋ど真ん中）";
    }
    if (/なんば|難波/.test(haystack)) {
      return "なんば周辺（日本橋エリア徒歩圏）";
    }
    if (/谷町九丁目/.test(haystack)) {
      return "谷町九丁目駅周辺（日本橋エリア徒歩圏）";
    }
    if (/黒門/.test(haystack)) {
      return "黒門市場周辺（日本橋エリア徒歩圏）";
    }
    if (/千日前/.test(haystack)) {
      return "千日前駅周辺（日本橋エリア徒歩圏）";
    }
    if (/日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏/.test(haystack)) {
      return "日本橋駅徒歩圏";
    }
    return "日本橋ど真ん中（徒歩圏）";
  }

  if (/堺筋本町/.test(haystack)) return "近隣エリア（堺筋本町・日本橋からアクセス可）";
  if (/本町/.test(haystack)) return "近隣エリア（本町・日本橋からアクセス可）";
  if (/梅田/.test(haystack)) return "近隣エリア（梅田・大阪駅方面）";
  if (/西中島/.test(haystack)) return "近隣エリア（西中島・新大阪方面）";

  return `${area}エリア（日本橋周辺の関連店舗）`;
}

export function shopNearestStation(shop: ShopView): string {
  const haystack = buildLocationHaystack(shop);

  if (/近鉄日本橋/.test(haystack)) return "近鉄日本橋駅周辺";
  if (/日本橋/.test(haystack)) return "日本橋駅周辺";
  if (/なんば|難波/.test(haystack)) return "なんば周辺";
  if (/谷町九丁目/.test(haystack)) return "谷町九丁目駅周辺";
  if (/黒門/.test(haystack)) return "黒門市場周辺";
  if (/千日前/.test(haystack)) return "千日前駅周辺";
  if (/堺筋本町/.test(haystack)) return "堺筋本町駅周辺";
  if (/本町/.test(haystack)) return "本町駅周辺";
  if (/梅田/.test(haystack)) return "梅田・大阪駅周辺";
  if (/西中島/.test(haystack)) return "西中島南方・新大阪周辺";
  return "日本橋・近鉄日本橋周辺";
}

export function extractShopPriceYen(shop: ShopView): number {
  for (const key of PRICE_KEYS) {
    const raw = safeText(shop.acf[key]);
    const num = Number(raw.replace(/[^0-9]/g, ""));
    if (num > 0) return num;
  }
  return 0;
}

export function formatShopPriceLabel(shop: ShopView): string {
  const yen = extractShopPriceYen(shop);
  if (yen > 0) return `${yen.toLocaleString("ja-JP")}円`;
  if (shop.officialUrl) return "公式サイト確認中";
  return "要確認";
}

export function shopHoursText(shop: ShopView): string {
  const hours = safeText(shop.acf.shop_hours);
  return hours || "店舗ページで確認";
}

export function isLateNightShop(shop: ShopView): boolean {
  const hours = safeText(shop.acf.shop_hours);
  if (!hours) return false;
  return /翌|24[:：]|25[:：]|26[:：]|27[:：]|28[:：]|29[:：]|30[:：]|深夜|23[:：]/.test(
    hours
  );
}

export function isBeginnerFriendlyShop(shop: ShopView): boolean {
  const hours = safeText(shop.acf.shop_hours);
  const tel = safeText(shop.acf.shop_tel);
  const booking = safeText(shop.acf.shop_booking);
  const editor = safeText(shop.acf.shop_ai_summary);
  const hasOfficial = Boolean(shop.officialUrl);
  const hasPrice = extractShopPriceYen(shop) > 0;

  let score = 0;
  if (hours) score += 1;
  if (hasOfficial) score += 1;
  if (hasPrice) score += 1;
  if (booking || tel) score += 1;
  if (editor) score += 1;

  return score >= 3;
}

export function isStationNearShop(shop: ShopView): boolean {
  if (classifyNihonbashiLocation(shop) !== "core") return false;
  const haystack = buildLocationHaystack(shop);
  return (
    CORE_STATION_PATTERN.test(haystack) ||
    /日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏/.test(haystack)
  );
}

export function shopFeatureTags(shop: ShopView): string[] {
  const tags: string[] = [];
  if (isLateNightShop(shop)) tags.push("深夜営業");
  if (isStationNearShop(shop)) tags.push("駅近");
  if (isBeginnerFriendlyShop(shop)) tags.push("初心者向け");
  const booking = safeText(shop.acf.shop_booking);
  if (booking.includes("完全予約")) tags.push("完全予約制");
  if (shop.officialUrl) tags.push("公式サイトあり");
  if (tags.length === 0) tags.push("情報確認中");
  return tags.slice(0, 5);
}

export function shopReviewCount(shop: ShopView): number {
  const raw = safeText(shop.acf.review_count) || safeText(shop.acf.shop_review_count);
  const num = Number(raw.replace(/[^0-9]/g, ""));
  return num > 0 ? num : 0;
}

export function shopReviewCountLabel(shop: ShopView): string {
  const count = shopReviewCount(shop);
  if (count > 0) return `${count}件`;
  return "口コミ募集中";
}

export function aggregateReviewCountLabel(shops: ShopView[]): string {
  const total = shops.reduce((sum, shop) => sum + shopReviewCount(shop), 0);
  if (total > 0) return `${total}件`;
  return "口コミ募集中";
}

export function buildEditorComment(shop: ShopView): string {
  const area = shopAreaLabel(shop);
  const hours = safeText(shop.acf.shop_hours);
  const parts: string[] = [
    `${area}エリアの${shop.title}について、公開情報・店舗ページ掲載内容をもとに整理した編集部コメントです。`
  ];
  if (hours) {
    parts.push(`営業時間は「${hours}」と掲載されています。`);
  } else {
    parts.push("営業時間は店舗ページまたは公式情報での確認をおすすめします。");
  }
  if (shop.officialUrl) {
    parts.push("公式サイトから予約・問い合わせ導線を確認できます。");
  }
  parts.push("料金やコース内容は変更される場合があるため、来店前に最新情報をご確認ください。");
  return parts.join("");
}

export function buildEditorCommentShort(shop: ShopView): string {
  const summary = safeText(shop.acf.shop_ai_summary);
  if (summary) {
    const plain = summary.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
  }
  const relation = resolveNihonbashiRelation(shop);
  const hours = safeText(shop.acf.shop_hours);
  if (hours) {
    return `${relation}。営業時間は「${hours}」。公開情報をもとに編集部が整理したコメントです。`;
  }
  return `${relation}。公開情報・店舗ページをもとに編集部が比較しやすく整理したコメントです。`;
}

export function resolveLastUpdatedLabel(shops: ShopView[]): string {
  const dates = shops
    .map((s) => safeText(s.acf.shop_updated_at))
    .filter(Boolean);
  if (dates.length === 0) return "2026年6月13日";
  return "2026年6月13日";
}

export function nihonbashiRankingScore(shop: ShopView): number {
  let score = 0;
  if (classifyNihonbashiLocation(shop) === "core") score += 4;
  else if (classifyNihonbashiLocation(shop) === "nearby") score += 2;
  if (extractShopPriceYen(shop) > 0) score += 2;
  if (safeText(shop.acf.shop_hours)) score += 2;
  if (shop.officialUrl) score += 2;
  if (safeText(shop.acf.shop_ai_summary)) score += 2;
  if (isStationNearShop(shop)) score += 1;
  if (isLateNightShop(shop)) score += 1;
  return score;
}

export function sortNihonbashiShopsForRanking(shops: ShopView[]): ShopView[] {
  return [...shops].sort((a, b) => {
    const tierOrder = { core: 0, nearby: 1, related: 2 };
    const tierDiff =
      tierOrder[classifyNihonbashiLocation(a)] - tierOrder[classifyNihonbashiLocation(b)];
    if (tierDiff !== 0) return tierDiff;
    return nihonbashiRankingScore(b) - nihonbashiRankingScore(a);
  });
}

export function groupNihonbashiShops(shops: ShopView[]): {
  core: ShopView[];
  nearby: ShopView[];
} {
  const core: ShopView[] = [];
  const nearby: ShopView[] = [];
  for (const shop of shops) {
    const tier = classifyNihonbashiLocation(shop);
    if (tier === "core") core.push(shop);
    else nearby.push(shop);
  }
  return { core, nearby };
}
