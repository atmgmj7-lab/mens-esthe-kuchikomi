import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/;

export type EskomiReviewEntry = Readonly<{
  entryHandle: string;
  shopSlug: string;
  shopName: string;
  therapistDisplayName: string | null;
}>;

export type EskomiReviewSubmission = Readonly<{
  entryHandle: string;
  idempotencyHash: string;
  requestFingerprint: string;
  displayName: string;
  editReceiptHash: string;
  deviceFingerprintHash: string | null;
  ipPrefixHash: string | null;
  shopRating: number | null;
  commonComment: string;
  therapistRating: number | null;
}>;

export type EskomiPublicReview = Readonly<{
  publicHandle: string;
  rating: number | null;
  body: string;
  displayName: string | null;
  therapistDisplayName: string | null;
  publishedAt: string;
}>;

export type EskomiPublicGlobalReview = EskomiPublicReview & Readonly<{
  directoryId: number;
  shopSlug: string;
  shopName: string;
  areaSlug: string;
  areaName: string;
}>;

type Configuration = Readonly<{
  baseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  allowRawPostgrest?: boolean;
  fetchImpl?: typeof fetch;
}>;

function baseUrl(value: string | undefined, allowRawPostgrest = false): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && !(allowRawPostgrest && url.protocol === "http:"))
      || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntry(value: unknown): EskomiReviewEntry | null {
  if (!record(value)
    || !UUID_RE.test(String(value.entry_handle ?? ""))
    || typeof value.shop_slug !== "string" || !value.shop_slug
    || typeof value.shop_name !== "string" || !value.shop_name
    || !(typeof value.therapist_display_name === "string" || value.therapist_display_name === null)) return null;
  return {
    entryHandle: value.entry_handle as string,
    shopSlug: value.shop_slug,
    shopName: value.shop_name,
    therapistDisplayName: value.therapist_display_name as string | null,
  };
}

function validSubmission(value: EskomiReviewSubmission): boolean {
  return UUID_RE.test(value.entryHandle)
    && SHA256_RE.test(value.idempotencyHash)
    && SHA256_RE.test(value.requestFingerprint)
    && SHA256_RE.test(value.editReceiptHash)
    && (value.deviceFingerprintHash === null || SHA256_RE.test(value.deviceFingerprintHash))
    && (value.ipPrefixHash === null || SHA256_RE.test(value.ipPrefixHash))
    && value.displayName.trim().length <= 30
    && (value.shopRating === null || (Number.isInteger(value.shopRating) && value.shopRating >= 1 && value.shopRating <= 5))
    && value.commonComment.trim().length <= 400
    && (value.therapistRating === null || (Number.isInteger(value.therapistRating) && value.therapistRating >= 1 && value.therapistRating <= 5))
    && (value.shopRating !== null || value.therapistRating !== null || value.commonComment.trim().length > 0);
}

function parsePublicReview(value: unknown): EskomiPublicReview | null {
  if (!record(value) || !UUID_RE.test(String(value.public_handle ?? ""))
    || !(value.rating === null || (Number.isInteger(value.rating) && (value.rating as number) >= 1 && (value.rating as number) <= 5))
    || typeof value.body !== "string" || value.body.length > 400
    || !(typeof value.display_name === "string" || value.display_name === null)
    || !(typeof value.therapist_display_name === "string" || value.therapist_display_name === null)
    || typeof value.published_at !== "string" || Number.isNaN(Date.parse(value.published_at))) return null;
  return {
    publicHandle: value.public_handle as string,
    rating: value.rating as number | null,
    body: value.body,
    displayName: value.display_name as string | null,
    therapistDisplayName: value.therapist_display_name as string | null,
    publishedAt: value.published_at,
  };
}

function parsePublicGlobalReview(value: unknown): EskomiPublicGlobalReview | null {
  const review = parsePublicReview(value);
  if (!review || !record(value)
    || !Number.isSafeInteger(value.directory_id) || (value.directory_id as number) < 1
    || typeof value.shop_slug !== "string" || !value.shop_slug
    || typeof value.shop_name !== "string" || !value.shop_name
    || typeof value.area_slug !== "string" || !value.area_slug
    || typeof value.area_name !== "string" || !value.area_name) return null;
  return { ...review, directoryId: value.directory_id as number, shopSlug: value.shop_slug, shopName: value.shop_name, areaSlug: value.area_slug, areaName: value.area_name };
}

export function createEskomiReviewV2Repository(configuration: Configuration) {
  const url = baseUrl(configuration.baseUrl, configuration.allowRawPostgrest);
  const secret = configuration.serviceRoleKey;
  const fetchImpl = configuration.fetchImpl ?? fetch;

  async function rpc(name: string, payload: Record<string, unknown>): Promise<unknown | null> {
    if (!url || !secret) return null;
    try {
      const rawPostgrest = configuration.allowRawPostgrest || ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
      const response = await fetchImpl(`${url}${rawPostgrest ? "/rpc" : "/rest/v1/rpc"}/${name}`, {
        method: "POST",
        headers: createSupabaseServerHeaders(secret, {
          "Content-Type": "application/json",
          "Content-Profile": "api",
          "Accept-Profile": "api",
        }),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  return {
    async resolveEntry(entryHandle: string): Promise<EskomiReviewEntry | null> {
      if (!UUID_RE.test(entryHandle)) return null;
      const value = await rpc("resolve_review_entry_link", { p_entry_handle: entryHandle });
      return Array.isArray(value) && value.length === 1 ? parseEntry(value[0]) : null;
    },
    async submit(value: EskomiReviewSubmission): Promise<{ experienceId: string; replayed: boolean; benefitCode: string | null; benefitStatus: string } | null> {
      if (!validSubmission(value)) return null;
      const result = await rpc("submit_review_experience_v2", {
        p_entry_handle: value.entryHandle,
        p_idempotency_hash: value.idempotencyHash,
        p_request_fingerprint: value.requestFingerprint,
        p_guest_display_name: value.displayName.trim(),
        p_edit_receipt_hash: value.editReceiptHash,
        p_device_fingerprint_hash: value.deviceFingerprintHash,
        p_ip_prefix_hash: value.ipPrefixHash,
        p_shop_rating: value.shopRating,
        p_common_comment: value.commonComment.trim(),
        p_therapist_rating: value.therapistRating,
      });
      if (!Array.isArray(result) || result.length !== 1 || !record(result[0])
        || !UUID_RE.test(String(result[0].experience_id ?? "")) || typeof result[0].replayed !== "boolean"
        || !(typeof result[0].benefit_code === "string" || result[0].benefit_code === null)
        || typeof result[0].benefit_status !== "string") return null;
      return { experienceId: result[0].experience_id as string, replayed: result[0].replayed, benefitCode: result[0].benefit_code as string | null, benefitStatus: result[0].benefit_status as string };
    },
    async listPublications(shopSlug: string): Promise<readonly EskomiPublicReview[] | null> {
      if (!/^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/.test(shopSlug)) return null;
      const result = await rpc("list_public_review_experience_publications", { p_shop_slug: shopSlug, p_limit: 20, p_offset: 0 });
      if (!Array.isArray(result)) return null;
      const publications = result.map(parsePublicReview);
      return publications.every((publication): publication is EskomiPublicReview => publication !== null) ? publications : null;
    },
    async listGlobalPublications(page: number, perPage: number, areaSlug: string | null): Promise<{ reviews: readonly EskomiPublicGlobalReview[]; total: number } | null> {
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 50
        || (areaSlug !== null && !/^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/.test(areaSlug))) return null;
      const offset = (page - 1) * perPage;
      const [rows, total] = await Promise.all([
        rpc("list_public_review_experience_publications_global", { p_limit: perPage, p_offset: offset, p_area_slug: areaSlug }),
        rpc("count_public_review_experience_publications_global", { p_area_slug: areaSlug }),
      ]);
      if (!Array.isArray(rows) || !Number.isSafeInteger(total) || (total as number) < 0) return null;
      const reviews = rows.map(parsePublicGlobalReview);
      return reviews.every((review): review is EskomiPublicGlobalReview => review !== null)
        ? { reviews, total: total as number } : null;
    },
  };
}

export const eskomiReviewV2Repository = createEskomiReviewV2Repository({
  baseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: resolveSupabaseServerSecret()?.value,
  allowRawPostgrest: process.env.ESKOMI_E2E_RAW_POSTGREST === "1",
});
