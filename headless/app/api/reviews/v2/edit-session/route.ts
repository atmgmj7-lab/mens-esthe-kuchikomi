import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eskomiReviewV11Repository } from "@/lib/supabase/eskomi-review-v11";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("x-eskomi-csrf") !== "review-v2") return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  const secret = resolveSupabaseServerSecret()?.value; let body: { receipt?: unknown } = {};
  try { body = await request.json(); } catch { /* handled below */ }
  if (!secret || typeof body.receipt !== "string" || body.receipt.length < 32) return NextResponse.json({ ok: false, code: "INVALID_RECEIPT" }, { status: 400 });
  const token = randomBytes(32).toString("base64url"); const hmac = (v: string) => createHmac("sha256", secret).update(v).digest("hex");
  const result = await eskomiReviewV11Repository.editSession(hmac(`receipt|${body.receipt}`), hmac(`guest|${token}`), createHash("sha256").update("edit").digest("hex"));
  if (!result) return NextResponse.json({ ok: false, code: "RECEIPT_UNAVAILABLE" }, { status: 404 });
  const response = NextResponse.json({ ok: true, expiresAt: result.expires_at }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set("eskomi_v11_edit", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 30 }); return response;
}
