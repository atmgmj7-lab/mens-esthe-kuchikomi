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
  shopRating: number;
  shopBody: string;
  therapistRating: number | null;
  therapistBody: string | null;
}>;

type Configuration = Readonly<{
  baseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  fetchImpl?: typeof fetch;
}>;

function baseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
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
    && value.displayName.trim().length >= 1 && value.displayName.trim().length <= 80
    && Number.isInteger(value.shopRating) && value.shopRating >= 1 && value.shopRating <= 5
    && value.shopBody.trim().length >= 1 && value.shopBody.trim().length <= 4000
    && ((value.therapistRating === null && value.therapistBody === null)
      || (typeof value.therapistRating === "number" && Number.isInteger(value.therapistRating) && value.therapistRating >= 1 && value.therapistRating <= 5
        && typeof value.therapistBody === "string" && value.therapistBody.trim().length >= 1 && value.therapistBody.trim().length <= 4000));
}

export function createEskomiReviewV2Repository(configuration: Configuration) {
  const url = baseUrl(configuration.baseUrl);
  const secret = configuration.serviceRoleKey;
  const fetchImpl = configuration.fetchImpl ?? fetch;

  async function rpc(name: string, payload: Record<string, unknown>): Promise<unknown | null> {
    if (!url || !secret) return null;
    try {
      const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
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
    async submit(value: EskomiReviewSubmission): Promise<{ experienceId: string; replayed: boolean } | null> {
      if (!validSubmission(value)) return null;
      const result = await rpc("submit_review_experience", {
        p_entry_handle: value.entryHandle,
        p_idempotency_hash: value.idempotencyHash,
        p_request_fingerprint: value.requestFingerprint,
        p_guest_display_name: value.displayName.trim(),
        p_edit_receipt_hash: value.editReceiptHash,
        p_device_fingerprint_hash: value.deviceFingerprintHash,
        p_ip_prefix_hash: value.ipPrefixHash,
        p_shop_rating: value.shopRating,
        p_shop_body: value.shopBody.trim(),
        p_therapist_rating: value.therapistRating,
        p_therapist_body: value.therapistBody?.trim() ?? null,
      });
      if (!Array.isArray(result) || result.length !== 1 || !record(result[0])
        || !UUID_RE.test(String(result[0].experience_id ?? "")) || typeof result[0].replayed !== "boolean") return null;
      return { experienceId: result[0].experience_id as string, replayed: result[0].replayed };
    },
  };
}

export const eskomiReviewV2Repository = createEskomiReviewV2Repository({
  baseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: resolveSupabaseServerSecret()?.value,
});
