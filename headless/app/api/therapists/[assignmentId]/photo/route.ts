import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret, supabaseRpcUrl } from "@/lib/supabase/server-secret";
import { isPublicTherapistId } from "@/lib/public-therapist";

export async function GET(_: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const assignmentId = (await params).assignmentId;
  if (!isPublicTherapistId(assignmentId)) return new NextResponse(null, { status: 404 });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = resolveSupabaseServerSecret();
  if (!base || !secret) return new NextResponse(null, { status: 404 });
  const projection = await fetch(supabaseRpcUrl(base, "get_public_therapist_photo_v11"), {
    method: "POST",
    headers: createSupabaseServerHeaders(secret.value, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
    body: JSON.stringify({ p_assignment_id: assignmentId }),
    cache: "no-store",
  }).catch(() => null);
  const rows = projection?.ok ? await projection.json() as unknown : null;
  const row = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === "object" ? rows[0] as Record<string, unknown> : null;
  if (!row || typeof row.object_key !== "string" || !/^therapists\/[0-9a-f-]+\/[0-9a-f-]+\.(png|jpe?g|webp)$/i.test(row.object_key)
    || !["image/png", "image/jpeg", "image/webp"].includes(String(row.content_type))) return new NextResponse(null, { status: 404 });
  const stored = await fetch(`${base}/storage/v1/object/listing-application-private/${row.object_key}`, {
    headers: createSupabaseServerHeaders(secret.value), cache: "no-store",
  }).catch(() => null);
  if (!stored?.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(stored.body, { headers: { "Content-Type": String(row.content_type), "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
