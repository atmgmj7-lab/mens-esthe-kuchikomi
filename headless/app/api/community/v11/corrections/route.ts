import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eskomiCommunityV11Repository } from "@/lib/supabase/eskomi-community-v11";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const COOKIE = "eskomi_community_tag_v11"; const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
function send(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: noStore }); }
export async function POST(request: NextRequest) {
  let originOk = false; try { originOk = request.headers.get("x-eskomi-csrf") === "community-v11" && new URL(request.headers.get("origin") ?? "").host === request.headers.get("host"); } catch { /* invalid */ }
  if (!originOk) return send({ ok: false, code: "FORBIDDEN" }, 403);
  const secret = resolveSupabaseServerSecret()?.value; let input: Record<string, unknown>; try { input = await request.json(); } catch { return send({ ok: false, code: "INVALID" }, 400); }
  const sourceUrl = typeof input.sourceUrl === "string" ? input.sourceUrl.trim() || null : null;
  if (!secret || typeof input.slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/.test(input.slug) || typeof input.fieldKey !== "string" || !["name", "category", "price", "hours", "access", "official_url", "image", "other"].includes(input.fieldKey) || typeof input.proposedValue !== "string" || input.proposedValue.trim().length < 1 || input.proposedValue.trim().length > 1000 || !(typeof input.sourceUrl === "string" || input.sourceUrl === null) || (sourceUrl !== null && (sourceUrl.length > 2048 || !/^https:\/\//.test(sourceUrl))) || typeof input.idempotencyKey !== "string" || !UUID.test(input.idempotencyKey)) return send({ ok: false, code: "INVALID" }, 400);
  const target = await eskomiCommunityV11Repository.target("shop", input.slug); if (!target || typeof target.target_id !== "string") return send({ ok: false, code: "TARGET_UNAVAILABLE" }, 404);
  const cookieToken = request.cookies.get(COOKIE)?.value ?? randomBytes(32).toString("base64url"); const headerToken = request.headers.get("x-eskomi-community-tab"); const token = headerToken && /^[A-Za-z0-9_-]{32,128}$/.test(headerToken) ? headerToken : cookieToken; const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const payloadHash = createHash("sha256").update([target.target_id, input.fieldKey, input.proposedValue.trim(), sourceUrl ?? ""].join("\u001f")).digest("hex");
  const value = await eskomiCommunityV11Repository.rpc("submit_store_correction_v11", { p_shop_id: target.target_id, p_field_key: input.fieldKey, p_proposed_value: input.proposedValue, p_source_url: sourceUrl, p_scope_hash: hash(`correction-scope|${token}|${target.target_id}`), p_idempotency_hash: createHash("sha256").update(input.idempotencyKey).digest("hex"), p_payload_hash: payloadHash });
  if (value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).__rpc_error) return (value as { code?: string }).code === "54000" ? send({ ok: false, code: "RATE_LIMITED" }, 429) : send({ ok: false, code: "REPLAY_MISMATCH" }, 409);
  const result = Array.isArray(value) && value.length === 1 ? value[0] : null; if (!result) return send({ ok: false, code: "UNAVAILABLE" }, 503);
  const output = send({ ok: true, correction: result }, 201); output.cookies.set(COOKIE, cookieToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 }); return output;
}
