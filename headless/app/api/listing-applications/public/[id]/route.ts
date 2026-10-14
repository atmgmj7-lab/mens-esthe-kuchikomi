import { NextResponse } from "next/server";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; if (!UUID.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret(); if (!base || !secret) return NextResponse.json({ ok: false }, { status: 404 });
  const response = await fetch(`${base}/rest/v1/rpc/get_public_listing_projections`, { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }), body: "{}", cache: "no-store" });
  const records = response.ok ? await response.json() as unknown : []; const listing = Array.isArray(records) ? records.find((record) => record && typeof record === "object" && (record as { application_id?: unknown }).application_id === id) : null;
  if (!listing) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, listing }, { headers: { "Cache-Control": "no-store" } });
}
