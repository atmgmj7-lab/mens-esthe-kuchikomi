import "server-only";

import {
  OPERATOR_WRITER_FIELDS,
  type OperatorShopFactSnapshot,
  type OperatorWriterField,
} from "@/lib/dashboard/operator-shop-fact-dry-run";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

export type PartnerShopFactSnapshot = OperatorShopFactSnapshot & Readonly<{
  source: "supabase";
  revision: number;
  updatedAt: string;
}>;

export type PartnerShopFactSaveResult =
  | Readonly<{ status: "saved" | "noop"; snapshot: PartnerShopFactSnapshot }>
  | Readonly<{ status: "conflict"; snapshot: PartnerShopFactSnapshot }>
  | Readonly<{ status: "not_configured" | "request_failed" | "invalid_response" }>;

type Environment = Readonly<Record<string, string | undefined>>;
type Fetch = typeof fetch;

const RANK_UP_WP_SHOP_ID = 768;

function baseUrl(environment: Environment): string | null {
  const value = environment.SUPABASE_URL?.trim();
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function values(value: unknown): Record<OperatorWriterField, string | null> | null {
  if (!isRecord(value) || Object.keys(value).length !== OPERATOR_WRITER_FIELDS.length) return null;
  const parsed = {} as Record<OperatorWriterField, string | null>;
  for (const field of OPERATOR_WRITER_FIELDS) {
    const item = value[field];
    if (item !== null && (typeof item !== "string" || !item.trim())) return null;
    parsed[field] = item as string | null;
  }
  return parsed;
}

function snapshot(value: unknown): PartnerShopFactSnapshot | null {
  if (!isRecord(value)
    || value.wp_shop_id !== RANK_UP_WP_SHOP_ID
    || typeof value.shop_slug !== "string" || !value.shop_slug
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1
    || typeof value.updated_at !== "string") return null;
  const parsedValues = values(value.facts);
  return parsedValues === null ? null : {
    wpShopId: RANK_UP_WP_SHOP_ID,
    slug: value.shop_slug,
    values: parsedValues,
    source: "supabase",
    revision: value.revision as number,
    updatedAt: value.updated_at,
  };
}

function row(value: unknown): PartnerShopFactSnapshot | null {
  return Array.isArray(value) && value.length === 1 ? snapshot(value[0]) : null;
}

function facts(source: OperatorShopFactSnapshot): Record<OperatorWriterField, string | null> {
  return Object.fromEntries(OPERATOR_WRITER_FIELDS.map((field) => [field, source.values[field]])) as Record<OperatorWriterField, string | null>;
}

function validUpdates(updates: Readonly<Record<string, unknown>>): updates is Record<OperatorWriterField, string> {
  const keys = Object.keys(updates);
  return keys.length > 0 && keys.every((key) => OPERATOR_WRITER_FIELDS.includes(key as OperatorWriterField)
    && typeof updates[key] === "string" && updates[key].trim().length > 0);
}

export function useSupabaseShopManagement(environment: Environment = process.env): boolean {
  return environment.SHOP_MANAGEMENT_SOURCE === "supabase";
}

export function createPartnerShopFactsRepository(configuration: Readonly<{
  environment?: Environment;
  fetchImpl?: Fetch;
}> = {}) {
  const environment = configuration.environment ?? process.env;
  const endpoint = baseUrl(environment);
  const secret = resolveSupabaseServerSecret(environment)?.value ?? null;
  const fetchImpl = configuration.fetchImpl ?? fetch;

  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown | null> {
    if (!endpoint || !secret) return null;
    try {
      const response = await fetchImpl(`${endpoint}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: createSupabaseServerHeaders(secret, {
          "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api",
        }),
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!response.ok) return null;
      return await response.json();
    } catch { return null; }
  }

  return {
    async get(wpShopId: number): Promise<PartnerShopFactSnapshot | null> {
      if (wpShopId !== RANK_UP_WP_SHOP_ID) return null;
      return row(await rpc("get_partner_shop_fact_snapshot", { p_wp_shop_id: wpShopId }));
    },
    async importFromWordPress(source: OperatorShopFactSnapshot): Promise<PartnerShopFactSnapshot | null> {
      if (source.wpShopId !== RANK_UP_WP_SHOP_ID) return null;
      const value = await rpc("import_partner_shop_fact_snapshot", {
        p_wp_shop_id: source.wpShopId,
        p_shop_slug: source.slug,
        p_facts: facts(source),
        p_actor_label: "supabase-verification-import",
      });
      return row(value);
    },
    async save(input: Readonly<{
      wpShopId: number;
      expectedRevision: number;
      updates: Readonly<Record<string, unknown>>;
      actorLabel: string;
    }>): Promise<PartnerShopFactSaveResult> {
      if (!endpoint || !secret) return { status: "not_configured" };
      if (input.wpShopId !== RANK_UP_WP_SHOP_ID || !Number.isSafeInteger(input.expectedRevision)
        || input.expectedRevision < 1 || !validUpdates(input.updates) || !input.actorLabel.trim()) {
        return { status: "invalid_response" };
      }
      const value = await rpc("save_partner_shop_fact_snapshot", {
        p_wp_shop_id: input.wpShopId,
        p_expected_revision: input.expectedRevision,
        p_updates: input.updates,
        p_actor_label: input.actorLabel.trim(),
      });
      if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0]) || typeof value[0].state !== "string") {
        return { status: "request_failed" };
      }
      const parsed = snapshot(value[0]);
      if (!parsed) return { status: "invalid_response" };
      if (value[0].state === "saved" || value[0].state === "noop" || value[0].state === "conflict") {
        return { status: value[0].state, snapshot: parsed };
      }
      return { status: "invalid_response" };
    },
  };
}

export const partnerShopFactsRepository = createPartnerShopFactsRepository();
