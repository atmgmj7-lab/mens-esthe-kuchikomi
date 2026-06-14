import {
  areaRankingScore,
  classifyShopRelation,
  type AreaHubContext
} from "@/lib/area-shop-utils";
import { safeText } from "@/lib/wp/client";
import type { AreaView, ShopView } from "@/lib/wp/types";

/**
 * WordPress / 将来 Supabase から読み込む店舗ランキングメタ。
 * 未実装 ACF は optional（normalizeShopRanking 参照）。
 */
export type ShopRankingMeta = {
  /** ACF `area_rank` — 1 が最上位。0 / null / 空欄は未設定 */
  manualRank: number | null;
  /** 将来 ACF `ranking_priority`（未設定時は manualRank と同値） */
  rankingPriority: number | null;
  /** 将来 ACF `ranking_enabled`（未設定時は true） */
  isRankingEnabled: boolean;
  /** 将来 ACF `ranking_reason` */
  rankingReason: string;
  /** 将来 ACF `is_pr` */
  isPr: boolean;
  /** 将来 ACF `ranking_label`（例: 編集部おすすめ） */
  rankingLabel: string;
};

export const RANKING_PR_NOTE = "PR店舗が含まれる場合は、PR表記を行っています。";

const RELATION_ORDER = {
  core: 0,
  walkable: 1,
  nearby: 2,
  related: 3,
  dispatch: 4,
  unknown: 5
} as const;

function parseOptionalRank(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

function parseOptionalBool(value: unknown, defaultValue: boolean): boolean {
  if (value === null || value === undefined || value === "") return defaultValue;
  if (value === false || value === 0 || value === "0" || value === "false" || value === "no") {
    return false;
  }
  if (value === true || value === 1 || value === "1" || value === "true" || value === "yes") {
    return true;
  }
  return defaultValue;
}

/** REST ACF → ランキングメタ。`area_rank` は本番 REST で確認済み（key 存在・数値化可）。 */
export function normalizeShopRanking(acf: Record<string, unknown>): ShopRankingMeta {
  const manualRank = parseOptionalRank(acf.area_rank);
  // 将来追加予定: ranking_priority, ranking_enabled, ranking_reason, is_pr, ranking_label
  const rankingPriority = parseOptionalRank(acf.ranking_priority) ?? manualRank;
  const isRankingEnabled = parseOptionalBool(acf.ranking_enabled, true);
  const rankingReason = safeText(acf.ranking_reason);
  const isPr = parseOptionalBool(acf.is_pr, false);
  const rankingLabel = safeText(acf.ranking_label);

  return {
    manualRank,
    rankingPriority,
    isRankingEnabled,
    rankingReason,
    isPr,
    rankingLabel
  };
}

function shopUpdatedTimestamp(shop: ShopView): number {
  const raw = safeText(shop.acf.shop_updated_at);
  if (!raw) return 0;
  const parsed = Date.parse(raw.replace(/年|月/g, "-").replace(/日/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareAutoRanking(
  a: ShopView,
  b: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">
): number {
  const relDiff =
    RELATION_ORDER[classifyShopRelation(a, targetArea)] -
    RELATION_ORDER[classifyShopRelation(b, targetArea)];
  if (relDiff !== 0) return relDiff;
  return areaRankingScore(b, targetArea) - areaRankingScore(a, targetArea);
}

/**
 * 手動ランキング + 情報充実度のハイブリッドソート。
 * 1. isRankingEnabled=false → 最下位
 * 2. manualRank あり → 数値昇順（1 が最上位）
 * 3. manualRank なし → 既存の relation + areaRankingScore
 * 4. 更新日 → 店舗名で安定化
 */
export function compareShopsForRanking(
  a: ShopView,
  b: ShopView,
  targetArea: Pick<AreaView, "slug" | "name">
): number {
  if (a.ranking.isRankingEnabled !== b.ranking.isRankingEnabled) {
    return a.ranking.isRankingEnabled ? -1 : 1;
  }

  const aManual = a.ranking.manualRank;
  const bManual = b.ranking.manualRank;
  const aHasManual = aManual !== null;
  const bHasManual = bManual !== null;

  if (aHasManual && bHasManual && aManual !== bManual) {
    return aManual - bManual;
  }
  if (aHasManual !== bHasManual) {
    return aHasManual ? -1 : 1;
  }

  const autoDiff = compareAutoRanking(a, b, targetArea);
  if (autoDiff !== 0) return autoDiff;

  const updatedDiff = shopUpdatedTimestamp(b) - shopUpdatedTimestamp(a);
  if (updatedDiff !== 0) return updatedDiff;

  return a.title.localeCompare(b.title, "ja");
}

export function sortShopsForRanking(
  shops: ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">
): ShopView[] {
  return [...shops].sort((a, b) => compareShopsForRanking(a, b, targetArea));
}

/** エリアハブ #ranking 用 TOP N（ランキング無効店舗は除外） */
export function selectRankingTopShops(
  shops: ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">,
  limit = 5
): ShopView[] {
  return sortShopsForRanking(shops, targetArea)
    .filter((shop) => shop.ranking.isRankingEnabled)
    .slice(0, limit);
}

export function buildRankingIntro(ctx: Pick<AreaHubContext, "name" | "displayName">): string {
  const areaRef = ctx.displayName || ctx.name;
  return `${areaRef}周辺で検討しやすい店舗を、料金・営業時間・公式サイト情報・アクセス情報・編集部確認状況をもとに整理しています。掲載順は編集部の確認情報と店舗情報の充実度をもとに調整しています。`;
}

export function hasPrShopsInRanking(shops: ShopView[]): boolean {
  return shops.some((shop) => shop.ranking.isPr);
}

export function truncateRankingReason(reason: string, maxLength = 96): string {
  const plain = reason.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 1)}…` : plain;
}
