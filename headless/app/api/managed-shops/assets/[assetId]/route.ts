import { NextResponse } from "next/server";
import { managedShopDirectoryRepository } from "@/lib/supabase/managed-shop-directory";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f-]{36}$/i;
export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const assetId = (await params).assetId;
  if (!UUID.test(assetId)) return new NextResponse(null, { status: 404 });
  const asset = await managedShopDirectoryRepository.getPublishedAsset(assetId);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, ""); const secret = resolveSupabaseServerSecret();
  if (!asset || !base || !secret) return new NextResponse(null, { status: 404 });
  const stored = await fetch(`${base}/storage/v1/object/listing-application-private/${asset.object_key}`, { headers: createSupabaseServerHeaders(secret.value), cache: "no-store" });
  if (!stored.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(stored.body, { headers: { "Content-Type": asset.content_type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
