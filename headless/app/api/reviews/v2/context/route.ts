import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eskomiReviewV11Repository } from "@/lib/supabase/eskomi-review-v11";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const COOKIE = "eskomi_v11_guest";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("x-eskomi-csrf") !== "review-v2") return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  const secret = resolveSupabaseServerSecret()?.value; let body: { entryHandle?: unknown } = {};
  try { body = await request.json(); } catch { /* handled below */ }
  if (!secret || typeof body.entryHandle !== "string" || !UUID.test(body.entryHandle)) return NextResponse.json({ ok: false, code: "INVALID_CONTEXT" }, { status: 400 });
  const token = randomBytes(32).toString("base64url"); const hmac = (v: string) => createHmac("sha256", secret).update(v).digest("hex");
  const context = await eskomiReviewV11Repository.context(body.entryHandle, hmac(`guest|${token}`), createHash("sha256").update(body.entryHandle).digest("hex"));
  if (!context) return NextResponse.json({ ok: false, code: "CONTEXT_UNAVAILABLE" }, { status: 410 });
  const response = NextResponse.json({ ok: true, context }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  return response;
}
