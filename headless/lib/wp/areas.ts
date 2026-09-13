import { wpFetch } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeShop } from "@/lib/wp/normalize";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import { getAreaShopOrderIndex, fetchAreaShopsInOrder } from "@/lib/wp/area-shop-order";
import type { AreaView, ShopView, WpTerm } from "@/lib/wp/types";

function normalizeArea(term: WpTerm): AreaView {
  return {
    id: term.id,
    slug: term.slug,
    name: term.name,
    parent: term.parent,
    count: term.count,
    description: term.description || "",
    acf: term.acf || {}
  };
}

export async function getAreas(): Promise<AreaView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", "areas:all");
  try {
    const terms = await wpFetch<WpTerm[]>("/wp/v2/area?per_page=100&hide_empty=false");
    return terms.map(normalizeArea);
  } catch (error) {
    logWpBuildFallback("areas list", error);
    return [];
  }
}

export async function getAreaBySlug(slug: string): Promise<AreaView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:${slug}`);
  try {
    const terms = await wpFetch<WpTerm[]>(`/wp/v2/area?slug=${encodeURIComponent(slug)}&hide_empty=false`);
    return terms[0] ? normalizeArea(terms[0]) : null;
  } catch (error) {
    logWpBuildFallback(`area ${slug}`, error);
    return null;
  }
}

export async function getChildAreas(parentId: number): Promise<AreaView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:children:${parentId}`);
  try {
    const terms = await wpFetch<WpTerm[]>(`/wp/v2/area?parent=${parentId}&per_page=100&hide_empty=false`);
    return terms.map(normalizeArea);
  } catch (error) {
    logWpBuildFallback(`area children ${parentId}`, error);
    return [];
  }
}

export async function getParentArea(area: AreaView): Promise<AreaView | null> {
  if (!area.parent) return null;
  return getAreaById(area.parent);
}

export async function getAreaById(id: number): Promise<AreaView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:id:${id}`);
  try {
    const term = await wpFetch<WpTerm>(`/wp/v2/area/${id}?hide_empty=false`);
    return term ? normalizeArea(term) : null;
  } catch (error) {
    logWpBuildFallback(`area id ${id}`, error);
    return null;
  }
}

export async function getSiblingAreas(area: AreaView): Promise<AreaView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:siblings:${area.id}`);
  if (!area.parent) return [];
  try {
    const terms = await wpFetch<WpTerm[]>(
      `/wp/v2/area?parent=${area.parent}&per_page=100&hide_empty=false&exclude=${area.id}`
    );
    return terms.map(normalizeArea);
  } catch (error) {
    logWpBuildFallback(`area siblings ${area.id}`, error);
    return [];
  }
}

export const DEFAULT_SHOPS_PER_PAGE = 24;
/** エリアハブテンプレートの店舗一覧（1ページあたり） */
export const HUB_SHOPS_PER_PAGE = 12;

export type AreaShopsResult = {
  shops: ShopView[];
  totalPages: number;
};

export type GetAreaShopsOptions = {
  perPage?: number;
};

export async function getAreaShops(
  areaId: number,
  page = 1,
  options?: GetAreaShopsOptions
): Promise<AreaShopsResult> {
  "use cache";
  const perPage = options?.perPage ?? DEFAULT_SHOPS_PER_PAGE;
  cacheLife("minutes");
  cacheTag(
    "wp",
    "shops",
    `area:shops:${areaId}`,
    `area:shops:${areaId}:pp:${perPage}`,
    `area:shops:${areaId}:pp:${perPage}:page:${page}`
  );
  try {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) throw new Error("Invalid area page request");
    const index = await getAreaShopOrderIndex(areaId);
    const totalPages = Math.max(1, Math.ceil(index.length / perPage));
    const entries = index.slice((page - 1) * perPage, page * perPage);
    const shops = await fetchAreaShopsInOrder(areaId, entries);
    return { shops: shops.map(normalizeShop), totalPages };
  } catch (error) {
    logWpBuildFallback(`area shops ${areaId}`, error);
    return {
      shops: [],
      totalPages: 1
    };
  }
}

/** ランキング・条件別抽出用にエリア内店舗をまとめて取得 */
export async function getAreaRankingShops(areaId: number): Promise<ShopView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", `area:shops:${areaId}`, `area:shops:${areaId}:ranking`);
  try {
    const index = await getAreaShopOrderIndex(areaId);
    const shops = await fetchAreaShopsInOrder(areaId, index);
    return shops.map(normalizeShop);
  } catch (error) {
    logWpBuildFallback(`area ranking shops ${areaId}`, error);
    return [];
  }
}
