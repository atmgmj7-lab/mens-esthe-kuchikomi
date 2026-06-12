import { wpFetch } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeShop } from "@/lib/wp/normalize";
import type { AreaView, ShopView, WpShop, WpTerm } from "@/lib/wp/types";

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
  const terms = await wpFetch<WpTerm[]>("/wp/v2/area?per_page=100&hide_empty=false");
  return terms.map(normalizeArea);
}

export async function getAreaBySlug(slug: string): Promise<AreaView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:${slug}`);
  const terms = await wpFetch<WpTerm[]>(`/wp/v2/area?slug=${encodeURIComponent(slug)}&hide_empty=false`);
  return terms[0] ? normalizeArea(terms[0]) : null;
}

export async function getChildAreas(parentId: number): Promise<AreaView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:children:${parentId}`);
  const terms = await wpFetch<WpTerm[]>(`/wp/v2/area?parent=${parentId}&per_page=100&hide_empty=false`);
  return terms.map(normalizeArea);
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
  } catch {
    return null;
  }
}

export async function getSiblingAreas(area: AreaView): Promise<AreaView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("wp", "areas", `area:siblings:${area.id}`);
  if (!area.parent) return [];
  const terms = await wpFetch<WpTerm[]>(
    `/wp/v2/area?parent=${area.parent}&per_page=100&hide_empty=false&exclude=${area.id}`
  );
  return terms.map(normalizeArea);
}

export async function getAreaShops(areaId: number): Promise<ShopView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", `area:shops:${areaId}`);
  const shops = await wpFetch<WpShop[]>(`/wp/v2/shop?area=${areaId}&per_page=24&_embed=1`);
  return shops.map(normalizeShop);
}
