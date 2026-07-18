import "server-only";

import type {
  ShopInformationCoverage,
  ShopRankingSnapshot
} from "@/lib/shop-information-coverage";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type { ShopReviewViewModel } from "@/lib/shop-review-view-model";

export type ShopDetailModuleContext = {
  model: ShopDetailViewModel;
  review: ShopReviewViewModel;
  coverage: ShopInformationCoverage | null;
  ranking: ShopRankingSnapshot | null;
  hasNearby: boolean;
};

export type ShopDetailModuleDefinition = {
  id: string;
  label: string;
  layer: "primary" | "secondary";
  order: number;
  renderer: "reviews" | "information" | "prices" | "features" | "access" | "basic" | "nearby";
  sourceKeys: ReadonlyArray<"shop" | "reviews" | "fact-provenance" | "ranking-snapshot" | "area">;
  isVisible: (context: ShopDetailModuleContext) => boolean;
};

const hasOverview = (context: ShopDetailModuleContext) => Boolean(
  context.model.catchText ||
    context.model.introductionText ||
    context.model.recommendText ||
    context.model.summaryText
);
const hasAccess = (context: ShopDetailModuleContext) =>
  context.model.infoRows.some((row) => row.key === "address" || row.key === "station");
const hasBasic = (context: ShopDetailModuleContext) =>
  context.model.infoRows.some((row) => row.key !== "address" && row.key !== "station");

export const SHOP_DETAIL_MODULES = [
  { id: "reviews", label: "口コミ", layer: "primary", order: 10, renderer: "reviews", sourceKeys: ["reviews"], isVisible: () => true },
  { id: "shop-information", label: "店舗情報", layer: "primary", order: 20, renderer: "information", sourceKeys: ["shop", "fact-provenance", "ranking-snapshot"], isVisible: (context) => hasOverview(context) || context.model.infoRows.length > 0 || context.coverage !== null || context.ranking !== null },
  { id: "prices", label: "料金", layer: "primary", order: 30, renderer: "prices", sourceKeys: ["shop"], isVisible: (context) => context.model.prices.length > 0 },
  { id: "features", label: "こだわり", layer: "secondary", order: 40, renderer: "features", sourceKeys: ["shop"], isVisible: (context) => context.model.featureNames.length > 0 },
  { id: "map-access", label: "地図・アクセス", layer: "primary", order: 50, renderer: "access", sourceKeys: ["shop", "area"], isVisible: hasAccess },
  { id: "basic-information", label: "基本情報", layer: "secondary", order: 60, renderer: "basic", sourceKeys: ["shop"], isVisible: hasBasic },
  { id: "nearby", label: "周辺情報", layer: "secondary", order: 70, renderer: "nearby", sourceKeys: ["area"], isVisible: (context) => context.hasNearby }
] as const satisfies readonly ShopDetailModuleDefinition[];

export type ShopDetailModuleId = (typeof SHOP_DETAIL_MODULES)[number]["id"];
export type VisibleShopDetailModule = (typeof SHOP_DETAIL_MODULES)[number];

export type ShopSectionLink = {
  id: ShopDetailModuleId;
  label: string;
  layer: "primary" | "secondary";
};

export function getVisibleShopDetailModules(
  context: ShopDetailModuleContext
): VisibleShopDetailModule[] {
  return SHOP_DETAIL_MODULES.filter((definition) => definition.isVisible(context)).sort(
    (first, second) => first.order - second.order
  );
}

export function buildShopSectionLinks(
  modules: readonly VisibleShopDetailModule[]
): ShopSectionLink[] {
  return modules.map(({ id, label, layer }) => ({ id, label, layer }));
}
