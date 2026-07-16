import {
  fillHubPageToken,
  getHubTemplateConfig,
  NIHONBASHI_GUIDE_DESCRIPTION,
  NIHONBASHI_GUIDE_TITLE,
  NIHONBASHI_HUB_DESCRIPTION,
  NIHONBASHI_HUB_TITLE
} from "@/lib/area-hub-config";
import type { AreaHubRelationConfig, AreaHubSeoConfig } from "@/lib/area-hub-config";
import { safeText } from "@/lib/wp/client";
import {
  formatPriceForDisplay,
  normalizePrice,
  PRIMARY_PRICE_FIELD_KEYS,
  resolveShopPrimaryPrice
} from "@/lib/price-normalization";
import { normalizeContentItems, type NormalizedContentItem } from "@/lib/content-provenance";
import { resolveShopReviewSummary, shouldDisplayAggregateRating } from "@/lib/review-rating";
import {
  normalizeShopDisplayText,
  normalizeShopFactText
} from "@/lib/shop-fact-normalization";
import type { AreaView, ShopView } from "@/lib/wp/types";

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
  displayName: string;
  breadcrumbLabel: string;
  rankingTitle: string;
  priceTableTitle: string;
  stationIntro: string;
  faqAreaRef: string;
  faqFirstAnswer: string;
  relationCardLabel: string;
  shopLinks: AreaHubSeoConfig["shopLinks"];
  decisionGuide?: AreaHubSeoConfig["decisionGuide"];
  localGuide?: AreaHubSeoConfig["localGuide"];
  primaryGroupTitle: string;
  secondaryGroupTitle: string;
  pageTitlePage2Plus: string;
  pageDescriptionPage2Plus: string;
  guidePath?: string;
  guideTitle?: string;
  guideCtaLabel?: string;
};

const DISPATCH_PATTERN = /出張|デリバリー|派遣/;
const EXPLICIT_STATION_FIELDS = ["shop_station", "nearest_station", "station", "shop_access"] as const;
const WALK_MINUTES_PATTERN = /徒歩\s*(?:約\s*)?[0-9０-９]+\s*分/;
const BEGINNER_FEATURE_PATTERN = /初心者|初めての方|はじめての方/;

export {
  NIHONBASHI_GUIDE_DESCRIPTION,
  NIHONBASHI_GUIDE_TITLE,
  NIHONBASHI_HUB_DESCRIPTION,
  NIHONBASHI_HUB_TITLE
};


export function resolveAreaHubPageTitle(
  hubContext: AreaHubContext,
  currentPage: number
): string {
  if (currentPage <= 1) return hubContext.hubTitle;
  return fillHubPageToken(hubContext.pageTitlePage2Plus, currentPage);
}

export function resolveAreaHubPageDescription(
  hubContext: AreaHubContext,
  currentPage: number
): string {
  if (currentPage <= 1) return hubContext.hubDescription;
  return fillHubPageToken(hubContext.pageDescriptionPage2Plus, currentPage);
}

export function resolveAreaHubCanonicalPath(areaSlug: string, currentPage: number): string {
  if (currentPage <= 1) return `/area/${areaSlug}/`;
  return `/area/${areaSlug}/?page=${currentPage}`;
}

function buildGenericHubContext(
  area: AreaView,
  parentArea?: AreaView | null
): AreaHubContext {
  const parentName = parentArea?.name;
  const areaLabel = parentName ? `${parentName}${area.name}` : area.name;

  return {
    slug: area.slug,
    name: area.name,
    parentSlug: parentArea?.slug,
    parentName,
    displayName: areaLabel,
    breadcrumbLabel: `${areaLabel}メンズエステ`,
    hubTitle: `${areaLabel}メンズエステおすすめ一覧｜掲載情報・料金・営業時間で比較`,
    hubDescription: `${areaLabel}のメンズエステを店舗一覧、料金、営業時間、アクセス、掲載情報コメントで比較。深夜営業、駅近、初心者向け、料金目安をもとに${area.name}エリアの候補店舗を探せます。`,
    coverageLabel: `${area.name}エリア`,
    shopListH2: `${area.name}メンズエステ店舗一覧`,
    shopListIntro: `${areaLabel}のメンズエステを、料金目安・営業時間・アクセス・掲載情報コメントで比較できます。`,
    pageTitlePage2Plus: `${area.name}メンズエステ店舗一覧 {page}ページ目｜掲載情報・料金・営業時間で比較`,
    pageDescriptionPage2Plus: `${area.name}エリアのメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報で比較しながら探せます。`,
    rankingTitle: `${areaLabel}メンズエステおすすめランキング`,
    priceTableTitle: `${area.name}メンズエステ料金比較表`,
    stationIntro: "駅名や徒歩表記が掲載情報に含まれる店舗を整理しています。",
    faqAreaRef: area.name,
    faqFirstAnswer: `${area.name}エリアの店舗一覧ページから、営業時間・料金・掲載情報を比較しながら条件に合う店舗を絞り込むのがおすすめです。`,
    relationCardLabel: "対象エリアとの関係",
    shopLinks: {
      listLink: `${areaLabel}メンズエステの店舗一覧へ`,
      compareLink: `${area.name}の店舗一覧で比較する`,
      priceLink: `${area.name}の料金比較表へ`,
      stationLink: `駅近の${area.name}メンズエステ一覧へ`
    },
    primaryGroupTitle: `${area.name}エリア`,
    secondaryGroupTitle: "近隣・関連エリア"
  };
}

export function resolveAreaHubContext(
  area: AreaView,
  parentArea?: AreaView | null
): AreaHubContext {
  const config = getHubTemplateConfig(area.slug);
  if (!config) {
    return buildGenericHubContext(area, parentArea);
  }

  const { seo, relation } = config;

  return {
    slug: area.slug,
    name: area.name,
    parentSlug: parentArea?.slug ?? "osaka",
    parentName: parentArea?.name ?? "大阪",
    displayName: seo.displayName,
    breadcrumbLabel: seo.breadcrumbLabel,
    hubTitle: seo.hubTitle,
    hubDescription: seo.hubDescription,
    coverageLabel: seo.coverageLabel,
    shopListH2: seo.shopListH2,
    shopListIntro: seo.shopListIntro,
    pageTitlePage2Plus: seo.pageTitlePage2Plus,
    pageDescriptionPage2Plus: seo.pageDescriptionPage2Plus,
    rankingTitle: seo.rankingTitle,
    priceTableTitle: seo.priceTableTitle,
    stationIntro: seo.stationIntro,
    faqAreaRef: seo.faqAreaRef,
    faqFirstAnswer: seo.faqFirstAnswer,
    relationCardLabel: seo.relationCardLabel,
    shopLinks: seo.shopLinks,
    decisionGuide: seo.decisionGuide,
    localGuide: seo.localGuide,
    primaryGroupTitle: relation?.primaryGroupTitle ?? `${area.name}エリア`,
    secondaryGroupTitle: relation?.secondaryGroupTitle ?? "近隣・関連エリア",
    guidePath: seo.guidePath,
    guideTitle: seo.guideTitle,
    guideCtaLabel: seo.guideCtaLabel
  };
}

function buildLocationHaystack(shop: ShopView): string {
  const address = safeText(shop.acf.shop_address);
  const area = shopAreaLabel(shop);
  return `${address}${area}`;
}

export function shopStationAccessText(shop: ShopView): string {
  for (const key of EXPLICIT_STATION_FIELDS) {
    const value = normalizeShopDisplayText(shop.acf[key]);
    if (value) return value;
  }
  return "";
}

function hasExplicitStationWalk(shop: ShopView): boolean {
  const station = shopStationAccessText(shop);
  return /駅/.test(station) && WALK_MINUTES_PATTERN.test(station);
}

export function shopExplicitFeatureNames(shop: ShopView): string[] {
  const names = [shop.acf.shop_features, shop.acf.features, shop.acf.shop_facilities]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((value) => {
      if (typeof value === "string") return normalizeShopDisplayText(value);
      if (!value || typeof value !== "object") return "";
      return normalizeShopDisplayText((value as Record<string, unknown>).name);
    })
    .filter((value): value is string => Boolean(value));

  return [...new Set(names)];
}

export function shopBeginnerFeatureLabel(shop: ShopView): string {
  return shopExplicitFeatureNames(shop).find((feature) => BEGINNER_FEATURE_PATTERN.test(feature)) ?? "";
}

function isDispatchShop(shop: ShopView): boolean {
  return DISPATCH_PATTERN.test(buildLocationHaystack(shop));
}

function getRelationConfig(
  targetArea: Pick<AreaView, "slug" | "name">
): AreaHubRelationConfig | null {
  return getHubTemplateConfig(targetArea.slug)?.relation ?? null;
}

function classifyWithRelationConfig(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">,
  relConfig: AreaHubRelationConfig
): TargetAreaRelation {
  const haystack = buildLocationHaystack(shop);

  if (relConfig.relatedPattern?.test(haystack)) return "related";
  if (relConfig.corePattern.test(haystack)) {
    if (hasExplicitStationWalk(shop)) return "walkable";
    return "core";
  }
  if (relConfig.nearbyPattern?.test(haystack)) return "nearby";
  if (isShopInArea(shop, targetArea.slug)) return "related";
  return "unknown";
}

function resolveLabelWithRelationConfig(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">,
  relConfig: AreaHubRelationConfig
): string {
  const haystack = buildLocationHaystack(shop);
  const area = shopAreaLabel(shop);
  const relation = classifyShopRelation(shop, targetArea);

  if (relation === "dispatch") {
    return relConfig.dispatchLabel;
  }

  if (relConfig.corePattern.test(haystack)) {
    for (const rule of relConfig.labelRules) {
      if (rule.pattern.test(haystack)) return rule.label;
    }
  }

  for (const rule of relConfig.nearbyLabelRules ?? []) {
    if (rule.pattern.test(haystack)) return rule.label;
  }

  for (const rule of relConfig.relatedLabelRules ?? []) {
    if (rule.pattern.test(haystack)) return rule.label;
  }

  return `${area}エリア（${relConfig.fallbackRelatedLabel}）`;
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
  if (isDispatchShop(shop)) {
    return "dispatch";
  }

  const relConfig = getRelationConfig(targetArea);
  if (relConfig) {
    return classifyWithRelationConfig(shop, targetArea, relConfig);
  }

  if (isShopInArea(shop, targetArea.slug)) {
    if (hasExplicitStationWalk(shop)) return "walkable";
    return "core";
  }

  return "unknown";
}

export function resolveShopRelationLabel(
  shop: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">
): string {
  const relConfig = getRelationConfig(targetArea);
  if (relConfig) {
    return resolveLabelWithRelationConfig(shop, targetArea, relConfig);
  }

  const area = shopAreaLabel(shop);
  const relation = classifyShopRelation(shop, targetArea);

  if (relation === "dispatch") return `出張型（${targetArea.name}エリア対応）`;
  if (relation === "walkable") return `${targetArea.name}徒歩圏`;
  if (relation === "core") return `${targetArea.name}エリア`;
  if (relation === "nearby") return `近隣エリア（${targetArea.name}からアクセス可）`;
  if (relation === "related") return `${area}エリア（${targetArea.name}周辺の関連店舗）`;
  return `${area}エリア`;
}

export function shopNearestStation(shop: ShopView): string {
  return shopStationAccessText(shop);
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


export function isZeroLikePriceValue(value: unknown): boolean {
  const normalized = normalizePrice(value, "primary-course");
  return normalized.status !== "confirmed";
}

export function extractShopConfirmedPriceYen(shop: ShopView): number | null {
  const price = resolveShopPrimaryPrice(shop.acf);
  return price.status === "confirmed" ? price.amount : null;
}

export function extractShopPriceYen(shop: ShopView): number {
  return extractShopConfirmedPriceYen(shop) ?? 0;
}

export function resolvePriceDisplay(shop: ShopView): PriceDisplay {
  const price = resolveShopPrimaryPrice(shop.acf);
  const label = formatPriceForDisplay(price, "〜");

  if (price.status === "confirmed" && label) {
    return {
      status: "available",
      label,
      amount: price.amount ?? undefined
    };
  }

  const hasExplicitNotListed = PRIMARY_PRICE_FIELD_KEYS.some((key) => {
    const raw = safeText(shop.acf[key]);
    return /未掲載|非公開/.test(raw);
  });

  if (hasExplicitNotListed) {
    return { status: "not_listed", label: "料金未確認" };
  }

  if (shop.officialUrl) {
    return { status: "official_checking", label: "料金未確認" };
  }

  if (shop.slug) {
    return { status: "shop_page_check", label: "料金未確認" };
  }

  return { status: "unknown", label: "料金未確認" };
}

export function formatShopPriceLabel(shop: ShopView): string {
  return resolvePriceDisplay(shop).label;
}

export type RatingDisplayKind = "user_reviews" | "pending";

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
  return Boolean(shopBeginnerFeatureLabel(shop));
}

export function hasPublishedPrice(shop: ShopView): boolean {
  return extractShopConfirmedPriceYen(shop) !== null;
}

/** 駅名または徒歩表記がある場合のみ駅近とする（自動付与しない） */
export function isStationNearShop(
  shop: ShopView,
  _targetArea?: Pick<AreaView, "slug" | "name">
): boolean {
  return hasExplicitStationWalk(shop);
}

export function shopFeatureTags(
  shop: ShopView,
  targetArea?: Pick<AreaView, "slug" | "name">
): string[] {
  const tags: string[] = [];
  if (isLateNightShop(shop)) tags.push("深夜営業");
  if (isStationNearShop(shop, targetArea)) tags.push("駅名・徒歩案内あり");
  if (isBeginnerFriendlyShop(shop)) tags.push("初心者向け");
  const booking = safeText(shop.acf.shop_booking);
  if (booking.includes("完全予約")) tags.push("完全予約制");
  if (shop.officialUrl) tags.push("公式サイトあり");
  if (hasPublishedPrice(shop)) tags.push("料金掲載あり");
  if (tags.length === 0) tags.push("情報確認中");
  return tags.slice(0, 5);
}

export function extractShopUserReviewItems(shop: ShopView): NormalizedContentItem[] {
  const sourceField = Array.isArray(shop.acf.user_reviews)
    ? "user_reviews"
    : Array.isArray(shop.acf.reviews)
      ? "reviews"
      : "";
  const rawItems = sourceField === "user_reviews" ? shop.acf.user_reviews : sourceField === "reviews" ? shop.acf.reviews : [];

  return normalizeContentItems(rawItems, {
    shopId: shop.id,
    sourcePostType: "reviews",
    sourceField
  }).filter((item) => (
    item.canDisplayAsUserReview && item.shopId === String(shop.id)
  ));
}

export function shopReviewCount(shop: ShopView): number {
  return resolveShopReviewSummary(shop.acf, { shopId: shop.id }).reviewCount;
}

export function resolveRatingDisplay(shop: ShopView): RatingDisplay {
  const summary = resolveShopReviewSummary(shop.acf, { shopId: shop.id });
  const aggregate = summary.aggregate;

  if (shouldDisplayAggregateRating(aggregate)) {
    return {
      kind: "user_reviews",
      label: "口コミ評価",
      value: aggregate.ratingValue?.toFixed(1),
      count: aggregate.reviewCount
    };
  }

  if (summary.reviewCount > 0) {
    return {
      kind: "user_reviews",
      label: "口コミ",
      count: summary.reviewCount
    };
  }

  return {
    kind: "pending",
    label: "口コミ募集中"
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
  _targetArea?: Pick<AreaView, "slug" | "name">
): string {
  const summary = normalizeShopDisplayText(shop.acf.shop_ai_summary);
  if (!summary) return "";
  return summary.length > 90 ? `${summary.slice(0, 87)}...` : summary;
}

export type NormalizedShopUpdatedAt = {
  label: string;
  timestamp: number;
};

export function normalizeShopUpdatedAt(value: unknown): NormalizedShopUpdatedAt | null {
  const raw = normalizeShopFactText(value);
  const match =
    raw.match(/^(\d{4})-(\d{2})-(\d{2})$/) ||
    raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/) ||
    raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { label: `${year}年${month}月${day}日`, timestamp };
}

export function shopUpdatedTimestamp(shop: ShopView): number {
  return normalizeShopUpdatedAt(shop.acf.shop_updated_at)?.timestamp ?? 0;
}

export function resolveLastUpdatedLabel(shops: ShopView[]): string | null {
  const dates = shops
    .map((shop) => normalizeShopUpdatedAt(shop.acf.shop_updated_at))
    .filter((date): date is NormalizedShopUpdatedAt => Boolean(date))
    .sort((a, b) => b.timestamp - a.timestamp);
  return dates[0]?.label ?? null;
}

export function resolveShopLastVerifiedLabel(shop: ShopView): string | null {
  return normalizeShopUpdatedAt(shop.acf.shop_updated_at)?.label ?? null;
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
  if (extractShopConfirmedPriceYen(shop) !== null) score += 2;
  if (safeText(shop.acf.shop_hours)) score += 2;
  if (shop.officialUrl) score += 2;
  if (safeText(shop.acf.shop_ai_summary)) score += 2;
  if (isStationNearShop(shop, targetArea)) score += 1;
  if (isLateNightShop(shop)) score += 1;
  return score;
}

export { sortShopsForRanking, selectRankingTopShops } from "@/lib/shop-ranking";

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
  return getHubTemplateConfig(targetArea.slug)?.relation?.primaryGroupTitle ?? `${targetArea.name}エリア`;
}

export function secondaryGroupTitle(targetArea: Pick<AreaView, "slug" | "name">): string {
  return getHubTemplateConfig(targetArea.slug)?.relation?.secondaryGroupTitle ?? "近隣・関連エリア";
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
