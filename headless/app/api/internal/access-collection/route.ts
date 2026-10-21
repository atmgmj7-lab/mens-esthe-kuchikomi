import { createHash, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const requiredChecks = ["context_issuance", "event_ingest", "report_read", "retention_prune"] as const;
type CheckName = (typeof requiredChecks)[number];
type ManifestBody = { observedOn?: unknown; collector?: unknown; checks?: unknown };

const matchesSecret = (received: string | null, expected: string | undefined) => {
  if (!received || !expected) return false;
  const left = Buffer.from(received); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

const normalizedChecks = (checks: unknown): Record<CheckName, boolean> | null => {
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) return null;
  const candidate = checks as Record<string, unknown>;
  if (Object.keys(candidate).length !== requiredChecks.length || requiredChecks.some((name) => typeof candidate[name] !== "boolean")) return null;
  return Object.fromEntries(requiredChecks.map((name) => [name, candidate[name]])) as Record<CheckName, boolean>;
};

export async function POST(request: NextRequest) {
  if (!matchesSecret(request.headers.get("x-eskomi-access-collection-secret"), process.env.ESKOMI_ACCESS_COLLECTION_SECRET)) return new NextResponse(null, { status: 401, headers });
  let body: ManifestBody;
  try { body = await request.json() as ManifestBody; } catch { return new NextResponse(null, { status: 400, headers }); }
  const checks = normalizedChecks(body.checks);
  if (Object.keys(body).length !== 3 || typeof body.observedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.observedOn)
    || typeof body.collector !== "string" || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(body.collector) || !checks) return new NextResponse(null, { status: 400, headers });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return new NextResponse(null, { status: 503, headers });
  const manifest = JSON.stringify({ observedOn: body.observedOn, collector: body.collector, checks });
  const result = await fetch(`${base}/rest/v1/rpc/record_partner_shop_access_collection_manifest_v11`, {
    method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
    body: JSON.stringify({ p_observed_on: body.observedOn, p_collector_label: body.collector, p_required_check_count: requiredChecks.length, p_passed_check_count: requiredChecks.filter((name) => checks[name]).length, p_manifest_hash: createHash("sha256").update(manifest).digest("hex") }), cache: "no-store",
  }).catch(() => null);
  if (!result?.ok) return new NextResponse(null, { status: 503, headers });
  const state = await result.json().catch(() => null);
  if (state !== "complete" && state !== "partial") return new NextResponse(null, { status: 503, headers });
  // 204 cannot carry the state the independent scheduler needs for alerting.
  // A complete manifest is therefore an explicit 200; incomplete coverage is
  // an explicit 202 and must remain alertable rather than silently successful.
  return NextResponse.json({ state }, { status: state === "complete" ? 200 : 202, headers });
}
