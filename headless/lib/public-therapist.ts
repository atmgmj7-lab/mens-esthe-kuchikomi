import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret, supabaseRpcUrl } from "@/lib/supabase/server-secret";

export type PublicTherapistSummary = Readonly<{
  assignmentId: string;
  displayName: string;
  photoAssetId: string;
}>;

export type PublicTherapistProfile = Readonly<{
  assignmentId: string;
  displayName: string;
  shopSlug: string;
  shopName: string;
  shopPath: string;
  officialLineUrl: string | null;
  photoAssetId: string;
  reviews: ReadonlyArray<Readonly<{ reviewHandle: string; rating: number | null; publishedAt: string }>>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rpc(name: string, body: Record<string, unknown>): Promise<unknown[] | null> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return null;
  try {
    const response = await fetch(supabaseRpcUrl(base, name), {
      method: "POST",
      headers: createSupabaseServerHeaders(secret.value, {
        "Content-Type": "application/json",
        "Content-Profile": "api",
        "Accept-Profile": "api",
      }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const value = response.ok ? await response.json() : null;
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function getPublicTherapistsForShop(slug: string): Promise<PublicTherapistSummary[]> {
  if (!slug || /[\\/\u0000-\u001f]/.test(slug)) return [];
  const rows = await rpc("list_public_therapists_for_shop_v11", { p_shop_slug: slug, p_limit: 20 });
  if (!rows) return [];
  return rows.flatMap((row): PublicTherapistSummary[] => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    return UUID.test(String(value.assignment_id)) && typeof value.display_name === "string" && UUID.test(String(value.photo_asset_id))
      ? [{ assignmentId: value.assignment_id as string, displayName: value.display_name, photoAssetId: value.photo_asset_id as string }]
      : [];
  });
}

export async function getPublicTherapistProfile(assignmentId: string): Promise<PublicTherapistProfile | null> {
  if (!UUID.test(assignmentId)) return null;
  const rows = await rpc("get_public_therapist_profile_detail_v11", { p_assignment_id: assignmentId, p_limit: 20 });
  const first = rows?.[0];
  if (!first || typeof first !== "object") return null;
  const value = first as Record<string, unknown>;
  if (value.assignment_id !== assignmentId || typeof value.display_name !== "string" || typeof value.shop_slug !== "string"
    || typeof value.shop_name !== "string" || typeof value.shop_path !== "string" || !UUID.test(String(value.photo_asset_id))) return null;
  const reviews = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const review = row as Record<string, unknown>;
    const rating = typeof review.rating === "number" && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 ? review.rating : null;
    return UUID.test(String(review.review_handle)) && typeof review.published_at === "string"
      ? [{ reviewHandle: review.review_handle as string, rating, publishedAt: review.published_at }]
      : [];
  });
  return {
    assignmentId,
    displayName: value.display_name,
    shopSlug: value.shop_slug,
    shopName: value.shop_name,
    shopPath: value.shop_path,
    officialLineUrl: isHttpUrl(value.official_line_url) ? value.official_line_url : null,
    photoAssetId: value.photo_asset_id as string,
    reviews,
  };
}

export async function getPublicTherapistsForSitemap(): Promise<Array<{ assignmentId: string; updatedAt: Date }>> {
  const rows = await rpc("list_public_therapist_sitemap_v11", {});
  if (!rows) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    const updatedAt = typeof value.updated_at === "string" ? new Date(value.updated_at) : null;
    return UUID.test(String(value.assignment_id)) && updatedAt && Number.isFinite(updatedAt.valueOf())
      ? [{ assignmentId: value.assignment_id as string, updatedAt }]
      : [];
  });
}

export function isPublicTherapistId(value: string): boolean {
  return UUID.test(value);
}
