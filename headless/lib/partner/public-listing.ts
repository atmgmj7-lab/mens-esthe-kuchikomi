import "server-only";
import { cache } from "react";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

export type PublicPartnerListing = Readonly<{ shop_slug: string; canonical_url: string; shop_name: string; area: string; website_url: string; introduction: string | null; banner_asset_id: string | null; approved_revision: number }>;
// generateMetadata and the page can ask for this same no-store record during
// one React render. `cache` only deduplicates that request-local work; it does
// not retain a response between HTTP requests.
export const getPublicPartnerListing = cache(async (slug: string): Promise<PublicPartnerListing | null> => {
  if (!slug || /[\\/\u0000-\u001f]/.test(slug)) return null;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return null;
  const response = await fetch(`${base}/rest/v1/rpc/get_public_listing_store_by_slug`, { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }), body: JSON.stringify({ p_shop_slug: slug }), cache: "no-store" });
  if (!response.ok) return null;
  const row = await response.json() as unknown;
  const item = Array.isArray(row) ? row[0] : row;
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;
  return typeof value.shop_slug === "string" && typeof value.canonical_url === "string" && typeof value.shop_name === "string" && typeof value.area === "string" && typeof value.website_url === "string" && Number.isSafeInteger(value.approved_revision)
    ? { shop_slug: value.shop_slug, canonical_url: value.canonical_url, shop_name: value.shop_name, area: value.area, website_url: value.website_url, introduction: typeof value.introduction === "string" ? value.introduction : null, banner_asset_id: typeof value.banner_asset_id === "string" ? value.banner_asset_id : null, approved_revision: value.approved_revision as number }
    : null;
});
