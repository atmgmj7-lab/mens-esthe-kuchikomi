import { NextRequest, NextResponse } from "next/server";
import { eskomiReviewV11Repository } from "@/lib/supabase/eskomi-review-v11";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || (() => { try { return new URL(origin).host !== request.headers.get("host"); } catch { return true; } })() || request.headers.get("x-eskomi-csrf") !== "review-v2") return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  let body: { entryHandle?: unknown } = {}; try { body = await request.json(); } catch { /* invalid below */ }
  if (typeof body.entryHandle !== "string") return NextResponse.json({ ok: false, code: "INVALID_CONTEXT" }, { status: 400 });
  const therapists = await eskomiReviewV11Repository.therapists(body.entryHandle);
  return therapists === null ? NextResponse.json({ ok: false, code: "CONTEXT_UNAVAILABLE" }, { status: 410 }) : NextResponse.json({ ok: true, therapists }, { headers: { "Cache-Control": "no-store" } });
}
