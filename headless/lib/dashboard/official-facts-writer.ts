import "server-only";

import { Buffer } from "node:buffer";
import {
  OPERATOR_WRITER_FIELDS,
  type OperatorWriterField,
} from "@/lib/dashboard/operator-shop-fact-dry-run";

export type OfficialFactsSnapshot = Readonly<{
  wp_id: number;
  slug: string;
  fields: Readonly<Record<string, Readonly<{ exists: boolean; value: unknown }>>>;
}>;

/**
 * This comes from the reviewed-evidence workflow, never from browser input.
 * The PHP writer independently verifies every part of this envelope.
 */
export type ApprovedOfficialFactsEvidence = Readonly<{
  provenance: readonly Record<string, unknown>[];
  canonical: Readonly<Record<string, string>>;
  audit: Readonly<Record<string, Record<string, unknown>>>;
}>;

export type OfficialFactsWriterEnvironment = Readonly<{
  baseUrl: string;
  user: string;
  appPassword: string;
}>;

export type OfficialFactsWriteResult =
  | Readonly<{ state: "NOOP"; snapshot: OfficialFactsSnapshot; cachePublished: false }>
  | Readonly<{ state: "APPLIED"; snapshot: OfficialFactsSnapshot; cachePublished: boolean }>;

const MAX_BODY_BYTES = 262_144;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function normalizeBaseUrl(value: unknown): string | null {
  if (!nonEmpty(value)) return null;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function readOfficialFactsWriterEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): OfficialFactsWriterEnvironment | null {
  const baseUrl = normalizeBaseUrl(environment.WP_OFFICIAL_FACTS_BASE_URL);
  const user = environment.WP_OFFICIAL_FACTS_USER;
  const appPassword = environment.WP_OFFICIAL_FACTS_APP_PASSWORD;
  return baseUrl && nonEmpty(user) && nonEmpty(appPassword) ? { baseUrl, user, appPassword } : null;
}

function exactSnapshot(value: unknown): value is OfficialFactsSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (!Number.isSafeInteger(snapshot.wp_id) || (snapshot.wp_id as number) < 1 || typeof snapshot.slug !== "string" || !snapshot.slug
    || !snapshot.fields || typeof snapshot.fields !== "object" || Array.isArray(snapshot.fields)) return false;
  return Object.values(snapshot.fields as Record<string, unknown>).every((field) => field && typeof field === "object" && !Array.isArray(field)
    && typeof (field as { exists?: unknown }).exists === "boolean" && "value" in field);
}

function sameSnapshot(left: OfficialFactsSnapshot, right: OfficialFactsSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function authHeaders(environment: OfficialFactsWriterEnvironment): Headers {
  const credentials = Buffer.from(`${environment.user}:${environment.appPassword}`, "utf8").toString("base64");
  return new Headers({
    Authorization: `Basic ${credentials}`,
    Accept: "application/json",
  });
}

async function safeJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) throw new Error("official facts response rejected");
  const body = await response.text();
  if (body.length > MAX_BODY_BYTES) throw new Error("official facts response rejected");
  try { return JSON.parse(body) as unknown; } catch { throw new Error("official facts response rejected"); }
}

function assertChanges(changes: Readonly<Record<OperatorWriterField, string>>) {
  const keys = Object.keys(changes);
  if (keys.length === 0 || keys.some((key) => !(OPERATOR_WRITER_FIELDS as readonly string[]).includes(key))) {
    throw new Error("official facts changes rejected");
  }
  if (keys.some((key) => !nonEmpty(changes[key as OperatorWriterField]))) throw new Error("official facts changes rejected");
}

function assertEvidence(evidence: ApprovedOfficialFactsEvidence) {
  if (!Array.isArray(evidence.provenance) || evidence.provenance.length === 0
    || !evidence.canonical || Object.keys(evidence.canonical).length === 0
    || !evidence.audit || Object.keys(evidence.audit).length === 0) {
    throw new Error("official facts evidence required");
  }
}

export class OfficialFactsWriter {
  constructor(
    private readonly environment: OfficialFactsWriterEnvironment,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getSnapshot(wpShopId: number): Promise<OfficialFactsSnapshot> {
    if (!Number.isSafeInteger(wpShopId) || wpShopId < 1) throw new Error("official facts shop rejected");
    const response = await this.fetchImpl(`${this.environment.baseUrl}/wp-json/escomi/v1/official-facts/${wpShopId}`, {
      method: "GET",
      headers: authHeaders(this.environment),
      cache: "no-store",
    });
    const payload = await safeJson(response);
    if (!response.ok || !exactSnapshot(payload) || payload.wp_id !== wpShopId) throw new Error("official facts snapshot unavailable");
    return payload;
  }

  async apply({
    expected,
    changes,
    evidence,
    batchId,
  }: Readonly<{
    expected: OfficialFactsSnapshot;
    changes: Readonly<Record<OperatorWriterField, string>>;
    evidence: ApprovedOfficialFactsEvidence;
    batchId: string;
  }>): Promise<OfficialFactsWriteResult> {
    assertChanges(changes);
    assertEvidence(evidence);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId)) {
      throw new Error("official facts batch rejected");
    }
    const latest = await this.getSnapshot(expected.wp_id);
    if (latest.slug !== expected.slug || !sameSnapshot(latest, expected)) throw new Error("official facts snapshot conflict");

    const response = await this.fetchImpl(`${this.environment.baseUrl}/wp-json/escomi/v1/official-facts`, {
      method: "POST",
      headers: new Headers({ ...Object.fromEntries(authHeaders(this.environment)), "Content-Type": "application/json" }),
      cache: "no-store",
      body: JSON.stringify({ batch_id: batchId, wp_id: expected.wp_id, slug: expected.slug, expected, updates: changes, ...evidence }),
    });
    const payload = await safeJson(response);
    if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("official facts write rejected");
    const result = payload as Record<string, unknown>;
    if (result.state === "NOOP") return { state: "NOOP", snapshot: latest, cachePublished: false };
    if (result.state !== "APPLIED" || !exactSnapshot(result.snapshot)) throw new Error("official facts write rejected");

    const readback = await this.getSnapshot(expected.wp_id);
    if (!sameSnapshot(readback, result.snapshot)
      || Object.entries(changes).some(([field, value]) => readback.fields[field]?.value !== value)) {
      throw new Error("official facts readback failed");
    }
    return { state: "APPLIED", snapshot: readback, cachePublished: result.cache_published === true };
  }
}
