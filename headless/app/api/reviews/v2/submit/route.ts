import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eskomiReviewV11Repository } from "@/lib/supabase/eskomi-review-v11";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Input = { entryHandle: string; displayName: string; shopRating: number | null; commonComment: string; therapistRating: number | null };
function parsed(value: unknown): Input | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null; const v = value as Record<string, unknown>;
  const entryHandle = typeof v.entryHandle === "string" ? v.entryHandle : ""; const displayName = typeof v.displayName === "string" ? v.displayName.trim() : ""; const commonComment = typeof v.commonComment === "string" ? v.commonComment.trim() : "";
  const shopRating = v.shopRating === null ? null : Number.isInteger(v.shopRating) ? v.shopRating as number : -1;
  const therapistRating = v.therapistRating === null ? null : Number.isInteger(v.therapistRating) ? v.therapistRating as number : -1;
  if (!UUID.test(entryHandle) || displayName.length > 30 || commonComment.length > 400 || (shopRating !== null && (shopRating < 1 || shopRating > 5)) || (therapistRating !== null && (therapistRating < 1 || therapistRating > 5)) || (shopRating === null && therapistRating === null && !commonComment)) return null;
  return { entryHandle, displayName, shopRating, commonComment, therapistRating };
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("x-eskomi-csrf") !== "review-v2") return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  const secret = resolveSupabaseServerSecret()?.value; const key = request.headers.get("idempotency-key"); const session = request.cookies.get("eskomi_v11_guest")?.value;
  if (!secret || !key || !session || key.length > 200) return NextResponse.json({ ok: false, code: "CONTEXT_UNAVAILABLE" }, { status: 410 });
  let input: Input | null = null; try { input = parsed(await request.json()); } catch { /* handled below */ }
  if (!input) return NextResponse.json({ ok: false, code: "INVALID_SUBMISSION" }, { status: 400 });
  const hmac = (value: string) => createHmac("sha256", secret).update(value).digest("hex"); const receipt = randomBytes(32).toString("base64url");
  const idempotencyHash = createHash("sha256").update(key).digest("hex"); const sessionHash = hmac(`guest|${session}`); const ipEntryHash = hmac(`ip-entry|${request.headers.get("x-vercel-forwarded-for") ?? "unavailable"}|${input.entryHandle}`);
  const result = await eskomiReviewV11Repository.submit({ p_entry_handle: input.entryHandle, p_session_secret_hash: sessionHash, p_idempotency_hash: idempotencyHash, p_request_fingerprint: createHash("sha256").update(JSON.stringify(input)).digest("hex"), p_receipt_hash: hmac(`receipt|${receipt}`), p_ip_shop_hash: sessionHash, p_shop_rating: input.shopRating, p_common_comment: input.commonComment, p_guest_display_name: input.displayName || null, p_therapist_rating: input.therapistRating });
  if (!result || typeof result.experience_id !== "string") return NextResponse.json({ ok: false, code: "SUBMISSION_UNAVAILABLE" }, { status: 503 });
  void eskomiReviewV11Repository.recordIpBurst(ipEntryHash, idempotencyHash);
  return NextResponse.json({ ok: true, experienceId: result.experience_id, replayed: result.replayed === true, receipt: result.replayed === true ? null : receipt, receiptExpiresAt: result.receipt_expires_at }, { status: result.replayed === true ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
