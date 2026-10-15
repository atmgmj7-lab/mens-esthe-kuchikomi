import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

type Environment = Readonly<Record<string, string | undefined>>;
type Fetch = typeof fetch;

export type ManagedShopPayload = Readonly<Record<string, unknown>>;
export type ManagedShopDetail = Readonly<Record<string, unknown>>;

export type PublishedManagedShop = Readonly<{
  managed_shop_id: string;
  directory_id: number;
  existing_wp_shop_id: number | null;
  shop_slug: string;
  canonical_url: string;
  approved_revision: number;
  shop_name: string;
  area_slug: string;
  area_name: string;
  official_url: string | null;
  introduction: string | null;
  address: string | null;
  business_hours: string | null;
  phone: string | null;
  line_url: string | null;
  booking_url: string | null;
  basic_price: number | null;
  price_90: number | null;
  banner_asset_id: string | null;
  gallery_asset_ids: readonly string[];
}>;
export type ManagedShopLegacySuppression = Readonly<{ existing_wp_shop_id: number; shop_slug: string }>;
export type ManagedShopLegacyListingState = Readonly<{
  existing_wp_shop_id: number;
  shop_slug: string;
  publication_state: "unlisted" | "deleted";
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function baseUrl(environment: Environment): string | null {
  const value = environment.SUPABASE_URL?.trim();
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function nullableString(value: unknown): string | null | undefined { return value === null ? null : string(value) ?? undefined; }
function nullableInt(value: unknown): number | null | undefined { return value === null ? null : Number.isSafeInteger(value) ? value as number : undefined; }

function publication(value: unknown): PublishedManagedShop | null {
  if (!record(value)) return null;
  const required = ["managed_shop_id", "shop_slug", "canonical_url", "shop_name", "area_slug", "area_name"] as const;
  if (required.some((key) => !string(value[key])) || !UUID.test(value.managed_shop_id as string)
    || !Number.isSafeInteger(value.directory_id) || (value.directory_id as number) < 1
    || !Number.isSafeInteger(value.approved_revision) || (value.approved_revision as number) < 1) return null;
  const existing = nullableInt(value.existing_wp_shop_id);
  const optional = ["introduction", "address", "business_hours", "phone", "line_url", "booking_url", "banner_asset_id"] as const;
  if (existing === undefined || nullableString(value.official_url) === undefined || optional.some((key) => nullableString(value[key]) === undefined)
    || nullableInt(value.basic_price) === undefined || nullableInt(value.price_90) === undefined
    || !Array.isArray(value.gallery_asset_ids) || !value.gallery_asset_ids.every((id) => typeof id === "string" && UUID.test(id))) return null;
  return {
    managed_shop_id: value.managed_shop_id as string,
    directory_id: value.directory_id as number,
    existing_wp_shop_id: existing,
    shop_slug: value.shop_slug as string,
    canonical_url: value.canonical_url as string,
    approved_revision: value.approved_revision as number,
    shop_name: value.shop_name as string,
    area_slug: value.area_slug as string,
    area_name: value.area_name as string,
    official_url: value.official_url as string | null,
    introduction: value.introduction as string | null,
    address: value.address as string | null,
    business_hours: value.business_hours as string | null,
    phone: value.phone as string | null,
    line_url: value.line_url as string | null,
    booking_url: value.booking_url as string | null,
    basic_price: value.basic_price as number | null,
    price_90: value.price_90 as number | null,
    banner_asset_id: value.banner_asset_id as string | null,
    gallery_asset_ids: Object.freeze([...value.gallery_asset_ids] as string[]),
  };
}
function legacySuppression(value: unknown): ManagedShopLegacySuppression | null {
  if (!record(value) || !Number.isSafeInteger(value.existing_wp_shop_id) || (value.existing_wp_shop_id as number) < 1 || !string(value.shop_slug)) return null;
  return Object.freeze({ existing_wp_shop_id: value.existing_wp_shop_id as number, shop_slug: value.shop_slug as string });
}
function legacyListingState(value: unknown): ManagedShopLegacyListingState | null {
  if (!record(value) || !Number.isSafeInteger(value.existing_wp_shop_id) || (value.existing_wp_shop_id as number) < 1
    || !string(value.shop_slug) || (value.publication_state !== "unlisted" && value.publication_state !== "deleted")) return null;
  return Object.freeze({
    existing_wp_shop_id: value.existing_wp_shop_id as number,
    shop_slug: value.shop_slug as string,
    publication_state: value.publication_state,
  });
}

function actor(value: string): string | null {
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 120 ? normalized : null;
}

function payload(value: ManagedShopPayload): ManagedShopPayload | null {
  return record(value) && !Array.isArray(value) ? value : null;
}

export function useSupabaseManagedShopDirectory(environment: Environment = process.env): boolean {
  return environment.SHOP_DIRECTORY_SOURCE === "supabase";
}

export function createManagedShopDirectoryRepository(configuration: Readonly<{
  environment?: Environment;
  fetchImpl?: Fetch;
}> = {}) {
  const environment = configuration.environment ?? process.env;
  const endpoint = baseUrl(environment);
  const secret = resolveSupabaseServerSecret(environment)?.value ?? null;
  const fetchImpl = configuration.fetchImpl ?? fetch;

  async function rpc(name: string, body: Record<string, unknown>, cache: RequestCache = "no-store"): Promise<unknown | null> {
    if (!endpoint || !secret) return null;
    try {
      const response = await fetchImpl(`${endpoint}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: createSupabaseServerHeaders(secret, {
          "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api",
        }),
        body: JSON.stringify(body),
        cache,
      });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }

  return {
    configured(): boolean { return Boolean(endpoint && secret); },
    async listPublished(): Promise<readonly PublishedManagedShop[]> {
      // The outer directory projection is tagged and invalidated when an
      // operator changes visibility. Do not retain an older RPC response here,
      // or an unlisted legacy store can be composed back into public pages.
      const response = await rpc("list_published_managed_shops", {}, "no-store");
      if (!Array.isArray(response)) return [];
      const parsed = response.map(publication);
      return parsed.every((item): item is PublishedManagedShop => item !== null) ? Object.freeze(parsed) : [];
    },
    async listUnlistedLegacySuppressions(): Promise<readonly ManagedShopLegacySuppression[]> {
      const response = await rpc("list_unlisted_managed_shop_legacy_identities", {}, "no-store");
      if (!Array.isArray(response)) return [];
      const parsed = response.map(legacySuppression);
      return parsed.every((item): item is ManagedShopLegacySuppression => item !== null) ? Object.freeze(parsed) : [];
    },
    async listLegacyListingStates(): Promise<readonly ManagedShopLegacyListingState[]> {
      const response = await rpc("list_managed_shop_legacy_listing_states", {}, "no-store");
      if (!Array.isArray(response)) return [];
      const parsed = response.map(legacyListingState);
      return parsed.every((item): item is ManagedShopLegacyListingState => item !== null) ? Object.freeze(parsed) : [];
    },
    async getDetail(managedShopId: string): Promise<ManagedShopDetail | null> {
      if (!UUID.test(managedShopId)) return null;
      const result = await rpc("get_operator_managed_shop_detail", { p_managed_shop_id: managedShopId });
      return record(result) ? Object.freeze(result) : null;
    },
    async importLegacy(input: Readonly<{ wpShopId: number; slug: string; payload: ManagedShopPayload; actorLabel: string }>): Promise<string | null> {
      if (!Number.isSafeInteger(input.wpShopId) || input.wpShopId < 1 || !input.slug || !payload(input.payload) || !actor(input.actorLabel)) return null;
      const result = await rpc("import_managed_shop_from_legacy", {
        p_wp_shop_id: input.wpShopId, p_shop_slug: input.slug, p_payload: input.payload, p_actor_label: actor(input.actorLabel),
      });
      return typeof result === "string" && UUID.test(result) ? result : null;
    },
    async create(input: Readonly<{ slug: string; payload: ManagedShopPayload; actorLabel: string }>): Promise<string | null> {
      if (!/^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/.test(input.slug) || !payload(input.payload) || !actor(input.actorLabel)) return null;
      const result = await rpc("create_managed_shop", { p_shop_slug: input.slug, p_payload: input.payload, p_actor_label: actor(input.actorLabel) });
      return typeof result === "string" && UUID.test(result) ? result : null;
    },
    async createAndPublish(input: Readonly<{ slug: string; payload: ManagedShopPayload; actorLabel: string }>): Promise<string | null> {
      if (!/^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/.test(input.slug) || !payload(input.payload) || !actor(input.actorLabel)) return null;
      const result = await rpc("create_and_publish_managed_shop", { p_shop_slug: input.slug, p_payload: input.payload, p_actor_label: actor(input.actorLabel) });
      return typeof result === "string" && UUID.test(result) ? result : null;
    },
    async importAndPublishLegacy(input: Readonly<{ wpShopId: number; slug: string; payload: ManagedShopPayload; actorLabel: string }>): Promise<string | null> {
      if (!Number.isSafeInteger(input.wpShopId) || input.wpShopId < 1 || !input.slug || !payload(input.payload) || !actor(input.actorLabel)) return null;
      const result = await rpc("import_and_publish_managed_shop_from_legacy", {
        p_wp_shop_id: input.wpShopId, p_shop_slug: input.slug, p_payload: input.payload, p_actor_label: actor(input.actorLabel),
      });
      return typeof result === "string" && UUID.test(result) ? result : null;
    },
    async saveDraft(input: Readonly<{ managedShopId: string; expectedRevision: number; payload: ManagedShopPayload; actorLabel: string }>): Promise<"ok" | "conflict" | "not_found" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !payload(input.payload) || !actor(input.actorLabel)) return null;
      const result = await rpc("save_managed_shop_draft", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_payload: input.payload, p_actor_label: actor(input.actorLabel) });
      return result === "ok" || result === "conflict" || result === "not_found" ? result : null;
    },
    async saveAndPublish(input: Readonly<{ managedShopId: string; expectedRevision: number; payload: ManagedShopPayload; actorLabel: string }>): Promise<"ok" | "conflict" | "not_found" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !payload(input.payload) || !actor(input.actorLabel)) return null;
      const result = await rpc("save_and_publish_managed_shop", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_payload: input.payload, p_actor_label: actor(input.actorLabel) });
      return result === "ok" || result === "conflict" || result === "not_found" ? result : null;
    },
    async submit(input: Readonly<{ managedShopId: string; expectedRevision: number; actorLabel: string }>): Promise<"ok" | "conflict" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !actor(input.actorLabel)) return null;
      const result = await rpc("submit_managed_shop_revision", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_actor_label: actor(input.actorLabel) });
      return result === "ok" || result === "conflict" ? result : null;
    },
    async review(input: Readonly<{ managedShopId: string; expectedRevision: number; decision: "approved" | "changes_requested"; actorLabel: string; note?: string | null }>): Promise<"ok" | "conflict" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !actor(input.actorLabel)
        || (input.decision !== "approved" && input.decision !== "changes_requested") || (input.note?.length ?? 0) > 5000) return null;
      const result = await rpc("review_managed_shop_revision", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_decision: input.decision, p_reviewer_label: actor(input.actorLabel), p_note: input.note ?? null });
      return result === "ok" || result === "conflict" ? result : null;
    },
    async setVisibility(input: Readonly<{ managedShopId: string; expectedRevision: number; visibility: "published" | "unlisted"; actorLabel: string }>): Promise<"ok" | "conflict" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !actor(input.actorLabel)
        || (input.visibility !== "published" && input.visibility !== "unlisted")) return null;
      const result = await rpc("set_managed_shop_visibility", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_visibility: input.visibility, p_actor_label: actor(input.actorLabel) });
      return result === "ok" || result === "conflict" ? result : null;
    },
    async archive(input: Readonly<{ managedShopId: string; expectedRevision: number; actorLabel: string }>): Promise<"ok" | "conflict" | "not_found" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !actor(input.actorLabel)) return null;
      const result = await rpc("archive_managed_shop", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_actor_label: actor(input.actorLabel) });
      return result === "ok" || result === "conflict" || result === "not_found" ? result : null;
    },
    async restoreArchiveToUnlisted(input: Readonly<{ managedShopId: string; expectedRevision: number; actorLabel: string }>): Promise<"ok" | "conflict" | "not_found" | null> {
      if (!UUID.test(input.managedShopId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || !actor(input.actorLabel)) return null;
      const result = await rpc("restore_archived_managed_shop_to_unlisted", { p_managed_shop_id: input.managedShopId, p_expected_revision: input.expectedRevision, p_actor_label: actor(input.actorLabel) });
      return result === "ok" || result === "conflict" || result === "not_found" ? result : null;
    },
    async attachAsset(input: Readonly<{ managedShopId: string; assetId: string; objectKey: string; sha256: string; contentType: "image/png" | "image/jpeg" | "image/webp"; byteSize: number; width: number; height: number; actorLabel: string }>): Promise<string | null> {
      if (!UUID.test(input.managedShopId) || !UUID.test(input.assetId) || !/^managed-shops\/[0-9a-f-]+\/[0-9a-f-]+\.(?:png|jpe?g|webp)$/i.test(input.objectKey)
        || !/^[0-9a-f]{64}$/i.test(input.sha256) || !Number.isSafeInteger(input.byteSize) || !Number.isSafeInteger(input.width) || !Number.isSafeInteger(input.height) || !actor(input.actorLabel)) return null;
      const result = await rpc("attach_managed_shop_asset", {
        p_managed_shop_id: input.managedShopId, p_asset_id: input.assetId, p_object_key: input.objectKey, p_sha256: input.sha256,
        p_content_type: input.contentType, p_byte_size: input.byteSize, p_width: input.width, p_height: input.height, p_actor_label: actor(input.actorLabel),
      });
      return typeof result === "string" && UUID.test(result) ? result : null;
    },
    async getPublishedAsset(assetId: string): Promise<Readonly<{ object_key: string; content_type: string }> | null> {
      if (!UUID.test(assetId)) return null;
      const result = await rpc("get_published_managed_shop_asset", { p_asset_id: assetId });
      const value = Array.isArray(result) ? result[0] : result;
      return record(value) && typeof value.object_key === "string" && typeof value.content_type === "string"
        ? Object.freeze({ object_key: value.object_key, content_type: value.content_type }) : null;
    },
  };
}

export const managedShopDirectoryRepository = createManagedShopDirectoryRepository();
