import { NextResponse } from "next/server";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret(); if (!base || !secret) return new NextResponse(null, { status: 404 });
  const asset = await fetch(`${base}/rest/v1/rpc/get_public_listing_banner`, { method: "POST", headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api" }), body: JSON.stringify({ p_application_id: id }), cache: "no-store" });
  const assets = asset.ok ? await asset.json() as Array<{ object_key?: string; content_type?: string }> : []; const item = assets[0]; if (!item?.object_key || !item.content_type) return new NextResponse(null, { status: 404 });
  const object = await fetch(`${base}/storage/v1/object/listing-application-private/${item.object_key}`, { headers: createSupabaseServerHeaders(secret.value), cache: "no-store" });
  if (!object.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(await object.arrayBuffer(), { headers: { "Content-Type": item.content_type, "Cache-Control": "public, max-age=300" } });
}
