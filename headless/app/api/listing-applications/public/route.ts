import { NextResponse } from "next/server";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret, supabaseRpcUrl } from "@/lib/supabase/server-secret";

export async function GET() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return NextResponse.json({ ok: true, listings: [] });
  const response = await fetch(supabaseRpcUrl(base, "get_public_listing_projections"), {
    method: "POST",
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }),
    body: "{}",
    cache: "no-store",
  });
  const listings = response.ok ? await response.json() : [];
  return NextResponse.json({ ok: true, listings: Array.isArray(listings) ? listings : [] }, { headers: { "Cache-Control": "no-store" } });
}
