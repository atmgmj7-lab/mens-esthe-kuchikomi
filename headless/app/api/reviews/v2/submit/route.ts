import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
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
function replayKey(): Buffer | null {
  const value = process.env.ESKOMI_REVIEW_REPLAY_KEY;
  if (!value) return null;
  try { const key = Buffer.from(value, "base64"); return key.length === 32 ? key : null; } catch { return null; }
}
function encryptReceipt(key: Buffer, receipt: string) {
  const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, nonce); const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ receipt }), "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([ciphertext, cipher.getAuthTag()]).toString("base64url"), nonce: nonce.toString("base64url") };
}
function decryptReceipt(key: Buffer, ciphertext: string, nonce: string): string | null {
  try { const bytes = Buffer.from(ciphertext, "base64url"); const tag = bytes.subarray(-16); const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url")); decipher.setAuthTag(tag); const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0, -16)), decipher.final()]).toString("utf8")) as { receipt?: unknown }; return typeof value.receipt === "string" ? value.receipt : null; } catch { return null; }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || (() => { try { return new URL(origin).host !== request.headers.get("host"); } catch { return true; } })() || request.headers.get("x-eskomi-csrf") !== "review-v2") return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  const secret = resolveSupabaseServerSecret()?.value; const key = request.headers.get("idempotency-key"); const session = request.cookies.get("eskomi_v11_guest")?.value;
  if (!secret || !key || !session || key.length > 200) return NextResponse.json({ ok: false, code: "CONTEXT_UNAVAILABLE" }, { status: 410 });
  let input: Input | null = null; try { input = parsed(await request.json()); } catch { /* handled below */ }
  if (!input) return NextResponse.json({ ok: false, code: "INVALID_SUBMISSION" }, { status: 400 });
  const hmac = (value: string) => createHmac("sha256", secret).update(value).digest("hex"); const receipt = randomBytes(32).toString("base64url");
  const idempotencyHash = createHash("sha256").update(key).digest("hex"); const sessionHash = hmac(`guest|${session}`); const ipEntryHash = hmac(`ip-entry|${request.headers.get("x-vercel-forwarded-for") ?? "unavailable"}|${input.entryHandle}`);
  const result = await eskomiReviewV11Repository.submit({ p_entry_handle: input.entryHandle, p_session_secret_hash: sessionHash, p_idempotency_hash: idempotencyHash, p_request_fingerprint: createHash("sha256").update(JSON.stringify(input)).digest("hex"), p_receipt_hash: hmac(`receipt|${receipt}`), p_ip_shop_hash: sessionHash, p_shop_rating: input.shopRating, p_common_comment: input.commonComment, p_guest_display_name: input.displayName || null, p_therapist_rating: input.therapistRating });
  if (!result || typeof result.experience_id !== "string") return NextResponse.json({ ok: false, code: "SUBMISSION_UNAVAILABLE" }, { status: 503 });
  void eskomiReviewV11Repository.recordIpBurst(ipEntryHash, idempotencyHash);
  const keyMaterial = replayKey(); let recoveredReceipt: string | null = null;
  if (result.replayed === true && keyMaterial) { const replay = await eskomiReviewV11Repository.fetchReplay(sessionHash, idempotencyHash); if (typeof replay?.ciphertext === "string" && typeof replay.nonce === "string" && replay.key_version === "test-v1") recoveredReceipt = decryptReceipt(keyMaterial, replay.ciphertext, replay.nonce); }
  if (result.replayed !== true && keyMaterial) { const replay = encryptReceipt(keyMaterial, receipt); await eskomiReviewV11Repository.storeReplay(sessionHash, idempotencyHash, replay.ciphertext, replay.nonce); }
  return NextResponse.json({ ok: true, experienceId: result.experience_id, replayed: result.replayed === true, receipt: result.replayed === true ? recoveredReceipt : receipt, receiptExpiresAt: result.receipt_expires_at }, { status: result.replayed === true ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
