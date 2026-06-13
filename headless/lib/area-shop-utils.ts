import { safeText } from "@/lib/wp/client";
import type { AreaView, ShopView } from "@/lib/wp/types";

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

/** 対象エリアとの位置関係 */
export type TargetAreaRelation =
  | "core"
  | "walkable"
  | "nearby"
  | "dispatch"
  | "related"
  | "unknown";

export type AreaHubContext = {
  slug: string;
  name: string;
  parentSlug?: string;
  parentName?: string;
  hubTitle: string;
  hubDescription: string;
  coverageLabel: string;
  shopListH2: string;
  shopListIntro: string;
  guidePath?: string;
  guideTitle?: string;
  guideCtaLabel?: string;
};

const NIHONBASHI_CORE_PATTERN =
  /近鉄日本橋|なんば|難波|谷町九丁目|黒門市場|黒門|千日前|日本橋[1-5１-５](?:[-‐−－]?\d)?丁目|日本橋駅|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏|(?<![都道府県市区町村])日本橋(?![駅])/;
const NIHONBASHI_RELATED_PATTERN = /梅田|西中島|新大阪|京橋/;
const NIHONBASHI_NEARBY_PATTERN = /堺筋本町|本町|心斎橋|道頓堀|天王寺/;
const DISPATCH_PATTERN = /出張|デリバリー|派遣/;
const WALKING_PATTERN =
  /徒歩|駅(?:より|から)?\d|駅周辺|駅前|徒歩圏/;

export const NIHONBASHI_HUB_TITLE =
  "大阪日本橋メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較";

export const NIHONBASHI_HUB_DESCRIPTION =
  "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステを店舗一覧、口コミ、料金、営業時間、アクセスで比較。深夜営業、駅近、初心者向け、料金目安、編集部コメントをもとに日本橋エリアの候補店舗を探せます。";

export const NIHONBASHI_GUIDE_TITLE =
  "日本橋メンズエステで失敗しない選び方｜料金相場・口コミの見方を解説";

export const NIHONBASHI_GUIDE_DESCRIPTION =
  "大阪日本橋・近鉄日本橋周辺でメンズエステを選ぶときのポイントを解説。料金相場、口コミの見方、営業時間、深夜営業、初心者が注意すべき点を整理し、店舗一覧・ランキングページへの導線も掲載しています。";

export function resolveAreaHubPageTitle(
  hubContext: AreaHubContext,
  currentPage: number
): string {
  if (currentPage <= 1) return hubContext.hubTitle;
  if (hubContext.slug === "nihonbashi") {
    return `大阪日本橋メンズエステ店舗一覧 ${currentPage}ページ目｜口コミ・料金・営業時間で比較`;
  }
  return `${hubContext.shopListH2}（${currentPage}ページ目）｜口コミ・料金・営業時間で比較`;
}

export function resolveAreaHubPageDescription(
  hubContext: AreaHubContext,
  currentPage: number
): string {
  if (currentPage <= 1) return hubContext.hubDescription;
  if (hubContext.slug === "nihonbashi") {
    return `大阪日本橋・近鉄日本橋・なんば周辺のメンズエステ店舗一覧（${currentPage}ページ目）。料金・営業時間・口コミ・編集部コメントで比較しながら探せます。`;
  }
  return `${hubContext.name}エリアのメンズエステ店舗一覧（${currentPage}ページ目）。料金・営業時間・口コミで比較しながら探せます。`;
}

export function resolveAreaHubCanonicalPath(areaSlug: string, currentPage: number): string {
  if (currentPage <= 1) return `/area/${areaSlug}/`;
  return `/area/${areaSlug}/?page=${currentPage}`;
}

export function resolveAreaHubContext(
  area: AreaView,
  parentArea?: AreaView | null
): AreaHubContext {
  if (area.slug === "nihonbashi") {
    return {
      slug: area.slug,
      name: area.name,
      parentSlug: parentArea?.slug ?? "osaka",
      parentName: parentArea?.name ?? "大阪",
      hubTitle: NIHONBASHI_HUB_TITLE,
      hubDescription: NIHONBASHI_HUB_DESCRIPTION,
      coverageLabel: "日本橋・近鉄日本橋・なんば・谷町九丁目・黒門市場周辺",
      shopListH2: "日本橋メンズエステ店舗一覧",
      shopListIntro:
        "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステを、口コミ・料金目安・営業時間・アクセス・編集部コメントで比較できます。日本橋ど真ん中の店舗を優先表示し、近隣エリアの関連店舗もあわせて掲載しています。",
      guidePath: "/osaka-nihonbashi/",
      guideTitle: "日本橋で失敗しない選び方を詳しく読む",
      guideCtaLabel: "選び方ガイドを見る"
    };
  }

  const parentName = parentArea?.name;
  const areaLabel = parentName ? `${parentName}${area.name}` : area.name;

  return {
    slug: area.slug,
    name: area.name,
    parentSlug: parentArea?.slug,
    parentName,
    hubTitle: `${areaLabel}メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較`,
    hubDescription: `${areaLabel}のメンズエステを店舗一覧、口コミ、料金、営業時間、アクセスで比較。深夜営業、駅近、初心者向け、料金目安、編集部コメントをもとに${area.name}エリアの候補店舗を探せます。`,
    coverageLabel: `${area.name}エリア`,
    shopListH2: `${area.name}メンズエステ店舗一覧`,
    shopListIntro: `${areaLabel}のメンズエステを、口コミ・料金目安・営業時間・アクセス・編集部コメントで比較できます。`
  };
}

function buildLocationHaystack(shop: ShopView): string {
  const address = safeText(shop.acf.shop_address);
  const area = shopAreaLabel(shop);
  return `${address}${area}`;
}

function hasNihonbashiCoreIndicator(text: string): boolean {
  return NIHONBASHI_CORE_PATTERN.test(text);
}

function hasNihonbashiRelatedIndicator(text: string): boolean {
  return NIHONBASHI_RELATED_PATTERN.test(text);
}

function hasNihonbashiNearbyIndicator(text: string): boolean {
  return NIHONBASHI_NEARBY_PATTERN.test(text);
}

function isDispatchShop(shop: ShopView): boolean {
  return DISPATCH_PATTERN.test(buildLocationHaystack(shop));
}

export function shopAreaLabel(shop: ShopView): string {
  const areaTerm = shop.terms.find((t) => t.parent !== 0) || shop.terms[0];
  return areaTerm?.name || "エリア未設定";
}

export function isShopInArea(shop: ShopView, areaSlug: string): boolean {
  if (shop.areaSlug === areaSlug) return true;
  return shop.terms.some((t) => t.slug === areaSlug);
}

export function classifyShopRelation(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">
): TargetAreaRelation {
  const haystack = buildLocationHaystack(shop);

  if (isDispatchShop(shop)) {
    return "dispatch";
  }

  if (targetArea.slug === "nihonbashi") {
    if (hasNihonbashiRelatedIndicator(haystack)) return "related";
    if (hasNihonbashiCoreIndicator(haystack)) {
      if (WALKING_PATTERN.test(haystack)) return "walkable";
      return "core";
    }
    if (hasNihonbashiNearbyIndicator(haystack)) return "nearby";
    if (isShopInArea(shop, targetArea.slug)) return "related";
    return "unknown";
  }

  if (isShopInArea(shop, targetArea.slug)) {
    if (WALKING_PATTERN.test(haystack)) return "walkable";
    return "core";
  }

  return "unknown";
}

export function resolveShopRelationLabel(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">
): string {
  const haystack = buildLocationHaystack(shop);
  const area = shopAreaLabel(shop);
  const relation = classifyShopRelation(shop, targetArea);

  if (targetArea.slug === "nihonbashi") {
    if (relation === "dispatch") {
      return "出張型（日本橋エリアへの派遣対応）";
    }
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
      if (
        /日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏/.test(
          haystack
        )
      ) {
        return "日本橋駅徒歩圏";
      }
      return "日本橋ど真ん中（徒歩圏）";
    }
    if (/堺筋本町/.test(haystack)) return "近隣エリア（堺筋本町・日本橋からアクセス可）";
    if (/本町/.test(haystack)) return "近隣エリア（本町・日本橋からアクセス可）";
    if (/梅田/.test(haystack)) return "関連エリア（梅田・大阪駅方面）";
    if (/西中島|新大阪/.test(haystack)) return "関連エリア（西中島・新大阪方面）";
    if (/京橋/.test(haystack)) return "関連エリア（京橋方面）";
    return `${area}エリア（日本橋周辺の関連店舗）`;
  }

  if (relation === "dispatch") return `出張型（${targetArea.name}エリア対応）`;
  if (relation === "walkable") return `${targetArea.name}徒歩圏`;
  if (relation === "core") return `${targetArea.name}エリア`;
  if (relation === "nearby") return `近隣エリア（${targetArea.name}からアクセス可）`;
  if (relation === "related") return `${area}エリア（${targetArea.name}周辺の関連店舗）`;
  return `${area}エリア`;
}

export function shopNearestStation(shop: ShopView): string {
  const haystack = buildLocationHaystack(shop);

  if (/近鉄日本橋/.test(haystack)) return "近鉄日本橋駅周辺";
  if (/日本橋駅/.test(haystack) && WALKING_PATTERN.test(haystack)) return "日本橋駅周辺";
  if (/なんば|難波/.test(haystack) && WALKING_PATTERN.test(haystack)) return "なんば周辺";
  if (/谷町九丁目/.test(haystack) && WALKING_PATTERN.test(haystack)) return "谷町九丁目駅周辺";
  if (/黒門/.test(haystack) && WALKING_PATTERN.test(haystack)) return "黒門市場周辺";
  if (/千日前/.test(haystack) && WALKING_PATTERN.test(haystack)) return "千日前駅周辺";
  if (/堺筋本町/.test(haystack) && WALKING_PATTERN.test(haystack)) return "堺筋本町駅周辺";
  if (/本町/.test(haystack) && WALKING_PATTERN.test(haystack)) return "本町駅周辺";
  if (/梅田/.test(haystack)) return "梅田・大阪駅周辺";
  if (/西中島/.test(haystack)) return "西中島南方・新大阪周辺";

  const stationMatch = haystack.match(/([^\s、。]+駅)(?:より|から|周辺|前)?/);
  if (stationMatch) return `${stationMatch[1]}周辺`;

  return "店舗ページで確認";
}

export type PriceDisplayStatus =
  | "available"
  | "unknown"
  | "official_checking"
  | "shop_page_check"
  | "not_listed";

export type PriceDisplay = {
  status: PriceDisplayStatus;
  label: string;
  amount?: number;
};

export function extractShopPriceYen(shop: ShopView): number {
  for (const key of PRICE_KEYS) {
    const raw = safeText(shop.acf[key]);
    const num = Number(raw.replace(/[^0-9]/g, ""));
    if (num > 0) return num;
  }
  return 0;
}

function extractRegisteredPriceText(shop: ShopView): string | null {
  for (const key of PRICE_KEYS) {
    const raw = safeText(shop.acf[key]);
    if (!raw) continue;
    if (/未掲載|非公開|要問合せ|要問い合わせ/.test(raw)) return null;
    const num = Number(raw.replace(/[^0-9]/g, ""));
    if (num > 0) continue;
    if (raw.replace(/[^0-9]/g, "") === "0") continue;
    return raw.trim();
  }
  return null;
}

export function resolvePriceDisplay(shop: ShopView): PriceDisplay {
  const yen = extractShopPriceYen(shop);
  if (yen > 0) {
    return {
      status: "available",
      label: `${yen.toLocaleString("ja-JP")}円〜`,
      amount: yen
    };
  }

  const registeredText = extractRegisteredPriceText(shop);
  if (registeredText) {
    return { status: "available", label: registeredText };
  }

  const hasEmptyPriceFields = PRICE_KEYS.some((key) => {
    const raw = safeText(shop.acf[key]);
    return raw && /未掲載|非公開/.test(raw);
  });
  if (hasEmptyPriceFields) {
    return { status: "not_listed", label: "未掲載" };
  }

  if (shop.officialUrl) {
    return { status: "official_checking", label: "公式サイト確認中" };
  }

  if (shop.slug) {
    return { status: "shop_page_check", label: "店舗ページで確認" };
  }

  return { status: "unknown", label: "要確認" };
}

export function formatShopPriceLabel(shop: ShopView): string {
  return resolvePriceDisplay(shop).label;
}

export type RatingDisplayKind = "user_reviews" | "editor_score" | "pending";

export type RatingDisplay = {
  kind: RatingDisplayKind;
  label: string;
  value?: string;
  count?: number;
};

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

export function hasPublishedPrice(shop: ShopView): boolean {
  return extractShopPriceYen(shop) > 0;
}

/** 駅名または徒歩表記がある場合のみ駅近とする（自動付与しない） */
export function isStationNearShop(
  shop: ShopView,
  targetArea?: Pick<AreaView, "slug" | "name">
): boolean {
  const haystack = buildLocationHaystack(shop);
  if (!WALKING_PATTERN.test(haystack)) return false;

  if (targetArea?.slug === "nihonbashi") {
    const relation = classifyShopRelation(shop, targetArea);
    if (relation !== "core" && relation !== "walkable") return false;
    return (
      /近鉄日本橋|なんば|難波|谷町九丁目|黒門|千日前/.test(haystack) ||
      /日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏/.test(
        haystack
      )
    );
  }

  return /駅/.test(haystack) && WALKING_PATTERN.test(haystack);
}

export function shopFeatureTags(
  shop: ShopView,
  targetArea?: Pick<AreaView, "slug" | "name">
): string[] {
  const tags: string[] = [];
  if (isLateNightShop(shop)) tags.push("深夜営業");
  if (isStationNearShop(shop, targetArea)) tags.push("駅近");
  if (isBeginnerFriendlyShop(shop)) tags.push("初心者向け");
  const booking = safeText(shop.acf.shop_booking);
  if (booking.includes("完全予約")) tags.push("完全予約制");
  if (shop.officialUrl) tags.push("公式サイトあり");
  if (hasPublishedPrice(shop)) tags.push("料金掲載あり");
  if (tags.length === 0) tags.push("情報確認中");
  return tags.slice(0, 5);
}

export function shopReviewCount(shop: ShopView): number {
  const raw = safeText(shop.acf.review_count) || safeText(shop.acf.shop_review_count);
  const num = Number(raw.replace(/[^0-9]/g, ""));
  return num > 0 ? num : 0;
}

export function resolveRatingDisplay(shop: ShopView): RatingDisplay {
  const reviewCount = shopReviewCount(shop);
  if (reviewCount > 0) {
    return {
      kind: "user_reviews",
      label: "口コミ評価",
      count: reviewCount
    };
  }

  const raw = safeText(shop.acf.review_star);
  if (raw && raw !== "0") {
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return {
        kind: "editor_score",
        label: "編集部参考スコア",
        value: raw
      };
    }
  }

  return {
    kind: "pending",
    label: "評価集計中"
  };
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

export function buildEditorCommentShort(
  shop: ShopView,
  targetArea?: Pick<AreaView, "slug" | "name">
): string {
  const summary = safeText(shop.acf.shop_ai_summary);
  if (summary) {
    const plain = summary.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
  }
  const relation = targetArea
    ? resolveShopRelationLabel(shop, targetArea)
    : shopAreaLabel(shop);
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

export function areaRankingScore(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">
): number {
  const relation = classifyShopRelation(shop, targetArea);
  const relationScore: Record<TargetAreaRelation, number> = {
    core: 4,
    walkable: 3,
    nearby: 2,
    related: 1,
    dispatch: 0,
    unknown: 0
  };

  let score = relationScore[relation];
  if (extractShopPriceYen(shop) > 0) score += 2;
  if (safeText(shop.acf.shop_hours)) score += 2;
  if (shop.officialUrl) score += 2;
  if (safeText(shop.acf.shop_ai_summary)) score += 2;
  if (isStationNearShop(shop, targetArea)) score += 1;
  if (isLateNightShop(shop)) score += 1;
  return score;
}

export function sortShopsForRanking(
  shops: ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">
): ShopView[] {
  const relationOrder: Record<TargetAreaRelation, number> = {
    core: 0,
    walkable: 1,
    nearby: 2,
    related: 3,
    dispatch: 4,
    unknown: 5
  };

  return [...shops].sort((a, b) => {
    const relDiff =
      relationOrder[classifyShopRelation(a, targetArea)] -
      relationOrder[classifyShopRelation(b, targetArea)];
    if (relDiff !== 0) return relDiff;
    return areaRankingScore(b, targetArea) - areaRankingScore(a, targetArea);
  });
}

export function groupShopsByRelation(
  shops: ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">
): { primary: ShopView[]; secondary: ShopView[] } {
  const primary: ShopView[] = [];
  const secondary: ShopView[] = [];

  for (const shop of shops) {
    const relation = classifyShopRelation(shop, targetArea);
    if (relation === "core" || relation === "walkable") {
      primary.push(shop);
    } else {
      secondary.push(shop);
    }
  }

  return { primary, secondary };
}

export function primaryGroupTitle(targetArea: Pick<AreaView, "slug" | "name">): string {
  if (targetArea.slug === "nihonbashi") return "日本橋ど真ん中・徒歩圏";
  return `${targetArea.name}エリア`;
}

export function secondaryGroupTitle(targetArea: Pick<AreaView, "slug" | "name">): string {
  if (targetArea.slug === "nihonbashi") return "近隣・関連エリア";
  return "近隣・関連エリア";
}

export function sanitizeTodayAnalysisText(raw: string): string {
  if (!raw) return "";
  let text = raw
    .replace(/本日の?出勤/g, "直近の出勤")
    .replace(/本日/g, "直近")
    .replace(/今すぐ案内可能/g, "空き状況は要確認")
    .replace(/今すぐ/g, "最新情報は")
    .replace(/すぐ案内可能/g, "空き状況は要確認")
    .replace(/\bTODAY\b/gi, "RECENT")
    .trim();
  return text;
}

export function isNihonbashiShop(shop: ShopView): boolean {
  return isShopInArea(shop, "nihonbashi");
}
