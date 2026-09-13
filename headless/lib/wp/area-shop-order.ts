import { wpFetchPaginated } from "@/lib/wp/client";
import { cacheLife, cacheTag } from "next/cache";
import type { WpShop } from "@/lib/wp/types";

export type AreaShopOrderEntry = { id: number; date: string };
const TRANSPORT_PAGE_SIZE = 100;
class AreaTotalChanged extends Error {}

function validId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

function validDate(date: string): boolean {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date)) return false;
  const time = new Date(`${date}Z`);
  return Number.isFinite(time.getTime()) && time.toISOString() === `${date}.000Z`;
}

/** Publish date only: ordinary fact/modified updates never change listing order. */
export function compareAreaShopOrder(a: AreaShopOrderEntry, b: AreaShopOrderEntry): number {
  return a.date === b.date ? b.id - a.id : a.date > b.date ? -1 : 1;
}

/** Unique ID transport is separate from public date DESC / ID DESC ordering. */
export async function fetchAreaShopOrderIndex(areaId: number, perPage = TRANSPORT_PAGE_SIZE): Promise<AreaShopOrderEntry[]> {
  if (!validId(areaId) || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new Error("Invalid area index request");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const entries: AreaShopOrderEntry[] = [];
      const seen = new Set<number>();
      let expectedTotal: number | undefined;
      let totalPages = 1;
      let previousId = 0;
      for (let page = 1; page <= totalPages; page += 1) {
        const { data, pagination } = await wpFetchPaginated<AreaShopOrderEntry[]>(
          `/wp/v2/shop?area=${areaId}&per_page=${perPage}&page=${page}&orderby=id&order=asc&_fields=id,date`
        );
        const { total, totalPages: reportedPages } = pagination;
        if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(reportedPages) || reportedPages < 0) throw new Error("Invalid area pagination metadata");
        if (expectedTotal !== undefined && total !== expectedTotal) throw new AreaTotalChanged("Area total changed during enumeration");
        expectedTotal = total;
        totalPages = Math.max(1, Math.ceil(total / perPage));
        if (reportedPages !== Math.ceil(total / perPage) && !(total === 0 && reportedPages === 1)) throw new Error("Inconsistent area totalPages");
        if (!Array.isArray(data) || data.length !== Math.min(perPage, Math.max(0, total - (page - 1) * perPage))) throw new Error("Incomplete area index page");
        for (const entry of data) {
          if (!entry || !validId(entry.id) || !validDate(entry.date)) throw new Error("Invalid area order entry");
          if (seen.has(entry.id) || entry.id <= previousId) throw new Error("Duplicate or unordered area transport ID");
          seen.add(entry.id);
          previousId = entry.id;
          entries.push({ id: entry.id, date: entry.date });
        }
      }
      if (seen.size !== expectedTotal) throw new Error("Incomplete area order index");
      return entries.sort(compareAreaShopOrder);
    } catch (error) {
      if (!(error instanceof AreaTotalChanged) || attempt === 1) throw error;
    }
  }
  throw new Error("Area order retry exhausted");
}

export async function getAreaShopOrderIndex(areaId: number): Promise<AreaShopOrderEntry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "shops", `area:shops:${areaId}`, `area:shops:${areaId}:order`);
  return fetchAreaShopOrderIndex(areaId);
}

/** Full responses may arrive in any order; reject missing, duplicate or stale records. */
export async function fetchAreaShopsInOrder(areaId: number, entries: AreaShopOrderEntry[]): Promise<WpShop[]> {
  const all: WpShop[] = [];
  for (let start = 0; start < entries.length; start += TRANSPORT_PAGE_SIZE) {
    const chunk = entries.slice(start, start + TRANSPORT_PAGE_SIZE);
    const expected = new Map(chunk.map(entry => [entry.id, entry.date]));
    const { data } = await wpFetchPaginated<WpShop[]>(
      `/wp/v2/shop?area=${areaId}&include=${chunk.map(entry => entry.id).join(",")}&per_page=100&page=1&_embed=1`
    );
    if (!Array.isArray(data) || data.length !== chunk.length) throw new Error("Incomplete area full records");
    const records = new Map<number, WpShop>();
    for (const record of data) {
      if (!record || !expected.has(record.id) || records.has(record.id) || record.date !== expected.get(record.id)) throw new Error("Duplicate, unexpected or changed area full record");
      records.set(record.id, record);
    }
    for (const entry of chunk) {
      const record = records.get(entry.id);
      if (!record) throw new Error("Missing area full record");
      all.push(record);
    }
  }
  return all;
}
