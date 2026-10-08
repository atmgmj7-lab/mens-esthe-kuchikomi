import "server-only";

import { partnerShopFactsRepository, useSupabaseShopManagement } from "@/lib/supabase/partner-shop-facts";
import type { ShopView } from "@/lib/wp/types";

export class ManagedShopSourceUnavailableError extends Error {
  constructor(reason: "snapshot_missing" | "identity_mismatch") {
    super(`managed shop source is unavailable: ${reason}`);
    this.name = "ManagedShopSourceUnavailableError";
  }
}

export function isManagedShopSourceUnavailableError(error: unknown): error is ManagedShopSourceUnavailableError {
  return error instanceof ManagedShopSourceUnavailableError
    || (typeof error === "object" && error !== null && "name" in error
      && (error as { name?: unknown }).name === "ManagedShopSourceUnavailableError");
}

/**
 * Non-public verification overlay for the approved WP768 migration slice.
 * It reads the same private Supabase snapshot written by the Operator route;
 * it never imports or writes from a public request. In the source switch,
 * absence, identity mismatch, or retrieval failure becomes a 5xx signal
 * rather than falling back to stale WP facts. A truly non-public WP record
 * remains a normal absence (404), without changing its publication status.
 */
export async function applyManagedShopFacts(shop: ShopView): Promise<ShopView | null> {
  if (!useSupabaseShopManagement() || shop.id !== 768) return shop;
  if (shop.publicationStatus !== "publish") return null;
  const snapshot = await partnerShopFactsRepository.get(shop.id);
  if (!snapshot) throw new ManagedShopSourceUnavailableError("snapshot_missing");
  if (snapshot.slug !== shop.slug) throw new ManagedShopSourceUnavailableError("identity_mismatch");
  const acf = { ...shop.acf };
  for (const [field, value] of Object.entries(snapshot.values)) {
    if (value !== null) acf[field] = value;
  }
  return {
    ...shop,
    acf,
    officialUrl: snapshot.values.official_url ?? shop.officialUrl,
  };
}

export async function applyManagedShopFactsToList(shops: readonly ShopView[]): Promise<ShopView[]> {
  const resolved = await Promise.all(shops.map((shop) => applyManagedShopFacts(shop)));
  return resolved.filter((shop): shop is ShopView => shop !== null);
}
