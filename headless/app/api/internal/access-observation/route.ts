import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const matchesSecret = (received: string | null, expected: string | undefined) => {
  if (!received || !expected) return false;
  const left = Buffer.from(received); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(request: NextRequest) {
  if (!matchesSecret(request.headers.get("x-eskomi-access-observation-secret"), process.env.ESKOMI_ACCESS_OBSERVATION_SECRET)) return new NextResponse(null, { status: 401, headers });
  let body: { observedOn?: unknown; state?: unknown };
  try { body = await request.json() as { observedOn?: unknown; state?: unknown }; } catch { return new NextResponse(null, { status: 400, headers }); }
  if (Object.keys(body).length !== 2 || typeof body.observedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.observedOn) || (body.state !== "complete" && body.state !== "partial")) return new NextResponse(null, { status: 400, headers });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  // A health check must not certify a day when the collector itself lacks the
  // signing key.  In that case no observation row is written (unknown).
  if (!base || !secret || !process.env.ESKOMI_ACCESS_CONTEXT_SECRET?.trim()) return new NextResponse(null, { status: 503, headers });
  const result = await fetch(`${base}/rest/v1/rpc/finalize_partner_shop_access_collection_day_v11`, {
    method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
    body: JSON.stringify({ p_observed_on: body.observedOn, p_collection_state: body.state }), cache: "no-store",
  }).catch(() => null);
  if (!result?.ok) return new NextResponse(null, { status: 503, headers });
  return new NextResponse(null, { status: 204, headers });
}
