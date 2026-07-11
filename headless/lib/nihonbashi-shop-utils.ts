/**
 * @deprecated 新規コードは @/lib/area-shop-utils を使用してください。
 * 既存インポート互換のため re-export のみ維持します。
 */
import { safeText } from "@/lib/wp/client";
import type { ShopView } from "@/lib/wp/types";
import {
  aggregateReviewCountLabel,
  buildEditorCommentShort,
  extractShopConfirmedPriceYen,
  extractShopPriceYen,
  formatShopPriceLabel,
  groupShopsByRelation,
  isBeginnerFriendlyShop,
  isLateNightShop,
  isNihonbashiShop,
  isStationNearShop as isStationNearShopGeneric,
  resolveLastUpdatedLabel,
  shopAreaLabel,
  shopFeatureTags as shopFeatureTagsGeneric,
  shopHoursText,
  shopNearestStation,
  shopReviewCount,
  shopReviewCountLabel,
  classifyShopRelation,
  resolveShopRelationLabel,
  sortShopsForRanking,
  areaRankingScore,
  NIHONBASHI_GUIDE_DESCRIPTION,
  NIHONBASHI_GUIDE_TITLE,
  NIHONBASHI_HUB_DESCRIPTION,
  NIHONBASHI_HUB_TITLE
} from "@/lib/area-shop-utils";

export {
  NIHONBASHI_GUIDE_DESCRIPTION,
  NIHONBASHI_GUIDE_TITLE,
  NIHONBASHI_HUB_DESCRIPTION,
  NIHONBASHI_HUB_TITLE,
  aggregateReviewCountLabel,
  buildEditorCommentShort,
  extractShopConfirmedPriceYen,
  extractShopPriceYen,
  formatShopPriceLabel,
  isBeginnerFriendlyShop,
  isLateNightShop,
  isNihonbashiShop,
  resolveLastUpdatedLabel,
  shopAreaLabel,
  shopHoursText,
  shopNearestStation,
  shopReviewCount,
  shopReviewCountLabel
};

export type { TargetAreaRelation as NihonbashiLocationTier } from "@/lib/area-shop-utils";

const NIHONBASHI_AREA = { slug: "nihonbashi", name: "日本橋" } as const;

export function classifyNihonbashiLocation(shop: ShopView) {
  const relation = classifyShopRelation(shop, NIHONBASHI_AREA);
  if (relation === "core" || relation === "walkable") return "core" as const;
  if (relation === "nearby") return "nearby" as const;
  return "related" as const;
}

export function resolveNihonbashiRelation(shop: ShopView): string {
  return resolveShopRelationLabel(shop, NIHONBASHI_AREA);
}

export function nihonbashiRankingScore(shop: ShopView): number {
  return areaRankingScore(shop, NIHONBASHI_AREA);
}

export function sortNihonbashiShopsForRanking(shops: ShopView[]): ShopView[] {
  return sortShopsForRanking(shops, NIHONBASHI_AREA);
}

export function groupNihonbashiShops(shops: ShopView[]): {
  core: ShopView[];
  nearby: ShopView[];
} {
  const { primary, secondary } = groupShopsByRelation(shops, NIHONBASHI_AREA);
  return { core: primary, nearby: secondary };
}

export function isStationNearShop(shop: ShopView): boolean {
  return isStationNearShopGeneric(shop, NIHONBASHI_AREA);
}

export function shopFeatureTags(shop: ShopView): string[] {
  return shopFeatureTagsGeneric(shop, NIHONBASHI_AREA);
}

/** @deprecated buildEditorCommentShort を使用 */
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
