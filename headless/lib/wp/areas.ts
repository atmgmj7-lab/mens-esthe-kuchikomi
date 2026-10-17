import { wpFetch } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeShop } from "@/lib/wp/normalize";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import { getAreaShopOrderIndex, fetchAreaShopsInOrder } from "@/lib/wp/area-shop-order";
import { applyManagedShopFactsToList, isManagedShopSourceUnavailableError } from "@/lib/shop-management-source";
import {
  composeManagedShopPublicationsForArea,
  getManagedShopDirectoryState,
  isManagedShopDirectoryUnavailableError,
} from "@/lib/managed-shop-source";
import { useSupabaseManagedShopDirectory } from "@/lib/supabase/managed-shop-directory";
import { getWordPressShopById } from "@/lib/wp/shops";
import { isAreaInformationOrderingTarget, paginateAreaShopInformationOrder } from "@/lib/area-shop-ordering";
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

// WordPress term ids are positive.  A deterministic negative id lets the
// existing AreaView-based templates address a Supabase-only area without
// inventing or persisting a WordPress identity.
function managedAreaId(slug: string): number {
  let hash = 2166136261;
  for (const character of slug) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return -((hash >>> 0) % 2147483646 + 1);
}

async function managedAreas(): Promise<AreaView[]> {
  if (!useSupabaseManagedShopDirectory()) return [];
  const state = await getManagedShopDirectoryState();
  const grouped = new Map<string, { name: string; count: number }>();
  for (const publication of state.publications) {
    const current = grouped.get(publication.area_slug);
    grouped.set(publication.area_slug, { name: publication.area_name, count: (current?.count ?? 0) + 1 });
  }
  return [...grouped.entries()].map(([slug, value]) => ({
    id: managedAreaId(slug), slug, name: value.name, parent: 0, count: value.count, description: "", acf: {},
  })).sort((left, right) => left.name.localeCompare(right.name, "ja"));
}

async function managedAreaBySlug(slug: string): Promise<AreaView | null> {
  return (await managedAreas()).find((area) => area.slug === slug) ?? null;
}

async function managedAreaById(id: number): Promise<AreaView | null> {
  return id < 0 ? (await managedAreas()).find((area) => area.id === id) ?? null : null;
}

export async function getAreas(): Promise<AreaView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", "areas:all");
  try {
    const terms = await wpFetch<WpTerm[]>("/wp/v2/area?per_page=100&hide_empty=false");
    const legacy = terms.map(normalizeArea);
    const canonical = await managedAreas();
    return [...legacy, ...canonical.filter((area) => !legacy.some((candidate) => candidate.slug === area.slug))];
  } catch (error) {
    logWpBuildFallback("areas list", error);
    try { return await managedAreas(); } catch (managedError) {
      if (isManagedShopDirectoryUnavailableError(managedError)) throw managedError;
      return [];
    }
  }
}

export async function getAreaBySlug(slug: string): Promise<AreaView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:${slug}`);
  try {
    const terms = await wpFetch<WpTerm[]>(`/wp/v2/area?slug=${encodeURIComponent(slug)}&hide_empty=false`);
    return terms[0] ? normalizeArea(terms[0]) : await managedAreaBySlug(slug);
  } catch (error) {
    logWpBuildFallback(`area ${slug}`, error);
    try { return await managedAreaBySlug(slug); } catch (managedError) {
      if (isManagedShopDirectoryUnavailableError(managedError)) throw managedError;
      return null;
    }
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
  const canonical = await managedAreaById(id);
  if (canonical) return canonical;
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

async function getManagedAreaShops(area: AreaView): Promise<ShopView[]> {
  const state = await getManagedShopDirectoryState();
  if (area.id < 0) return composeManagedShopPublicationsForArea(area.slug, [], [], state.publications, state.suppressions);
  const entries = await getAreaShopOrderIndex(area.id);
  const legacyAreaShops = (await fetchAreaShopsInOrder(area.id, entries)).map(normalizeShop);
  const directLegacyIds = new Set(legacyAreaShops.map((shop) => shop.id));
  const movedInLegacyShops = (await Promise.all(
    state.publications
      .filter((publication) => publication.existing_wp_shop_id !== null
        && publication.area_slug === area.slug
        && !directLegacyIds.has(publication.existing_wp_shop_id))
      .map((publication) => getWordPressShopById(publication.existing_wp_shop_id as number)),
  )).filter((shop): shop is ShopView => shop !== null);
  return composeManagedShopPublicationsForArea(
    area.slug,
    legacyAreaShops,
    movedInLegacyShops,
    state.publications,
    state.suppressions,
  );
}

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
    const area = await getAreaById(areaId);
    if (!area) return { shops: [], totalPages: 1 };
    if (!useSupabaseManagedShopDirectory()) {
      const index = await getAreaShopOrderIndex(areaId);
      if (isAreaInformationOrderingTarget(area)) {
        // Formal R1–R4 has to see the whole candidate set.  Cutting the WP
        // index first would permanently strand a better candidate on page 2.
        const candidates = await applyManagedShopFactsToList((await fetchAreaShopsInOrder(areaId, index)).map(normalizeShop));
        const result = paginateAreaShopInformationOrder(candidates, area, page, perPage);
        return { shops: result.shops, totalPages: result.totalPages };
      }
      const totalPages = Math.max(1, Math.ceil(index.length / perPage));
      const entries = index.slice((page - 1) * perPage, page * perPage);
      const shops = await fetchAreaShopsInOrder(areaId, entries);
      return { shops: await applyManagedShopFactsToList(shops.map(normalizeShop)), totalPages };
    }
    const managedShops = await applyManagedShopFactsToList(await getManagedAreaShops(area));
    if (isAreaInformationOrderingTarget(area)) {
      const result = paginateAreaShopInformationOrder(managedShops, area, page, perPage);
      return { shops: result.shops, totalPages: result.totalPages };
    }
    const totalPages = Math.max(1, Math.ceil(managedShops.length / perPage));
    return { shops: managedShops.slice((page - 1) * perPage, page * perPage), totalPages };
  } catch (error) {
    if (isManagedShopSourceUnavailableError(error) || isManagedShopDirectoryUnavailableError(error)) throw error;
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
    if (!useSupabaseManagedShopDirectory()) {
      const index = await getAreaShopOrderIndex(areaId);
      const shops = await fetchAreaShopsInOrder(areaId, index);
      return applyManagedShopFactsToList(shops.map(normalizeShop));
    }
    const area = await getAreaById(areaId);
    if (!area) return [];
    return applyManagedShopFactsToList(await getManagedAreaShops(area));
  } catch (error) {
    if (isManagedShopSourceUnavailableError(error) || isManagedShopDirectoryUnavailableError(error)) throw error;
    logWpBuildFallback(`area ranking shops ${areaId}`, error);
    return [];
  }
}
