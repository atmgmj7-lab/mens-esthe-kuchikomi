import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";
const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(_: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const assetId = (await params).assetId; if (!UUID.test(assetId)) return new NextResponse(null, { status: 404 });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret(); if (!base || !secret) return new NextResponse(null, { status: 404 });
  const projection = await fetch(`${base}/rest/v1/rpc/get_published_managed_shop_asset`, { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }), body: JSON.stringify({ p_asset_id: assetId }), cache: "no-store" });
  const rows = projection.ok ? await projection.json() as unknown : []; const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || typeof row !== "object" || typeof (row as Record<string, unknown>).object_key !== "string" || typeof (row as Record<string, unknown>).content_type !== "string") return new NextResponse(null, { status: 404 });
  const asset = row as { object_key: string; content_type: string };
  const stored = await fetch(`${base}/storage/v1/object/listing-application-private/${asset.object_key}`, { headers: createSupabaseServerHeaders(secret.value), cache: "no-store" });
  if (!stored.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(stored.body, { headers: { "Content-Type": asset.content_type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
