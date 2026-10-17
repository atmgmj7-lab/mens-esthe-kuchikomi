import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eskomiCommunityV11Repository } from "@/lib/supabase/eskomi-community-v11";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const COOKIE = "eskomi_community_tag_v11";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/;
const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

function sameOrigin(request: NextRequest) { try { return request.headers.get("x-eskomi-csrf") === "community-v11" && new URL(request.headers.get("origin") ?? "").host === request.headers.get("host"); } catch { return false; } }
function response(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: noStore }); }
function hmac(secret: string, value: string) { return createHmac("sha256", secret).update(value).digest("hex"); }
function isRpcError(value: unknown): value is { __rpc_error: true; code: string | null } { return !!value && typeof value === "object" && (value as Record<string, unknown>).__rpc_error === true; }
function browser(request: NextRequest) { return request.cookies.get(COOKIE)?.value ?? randomBytes(32).toString("base64url"); }
function mutationBrowser(request: NextRequest) { const value = request.headers.get("x-eskomi-community-tab"); return value && /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : browser(request); }
function tagResponse(payload: unknown, token: string, status = 200) { const result = response(payload, status); result.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 }); return result; }
async function target(scopeKind: unknown, slug: unknown) { return (scopeKind === "shop" || scopeKind === "area") && typeof slug === "string" && SLUG.test(slug) ? eskomiCommunityV11Repository.target(scopeKind, slug) : null; }

export async function GET(request: NextRequest) {
  const scopeKind = request.nextUrl.searchParams.get("scope"); const slug = request.nextUrl.searchParams.get("slug");
  const resolved = await target(scopeKind, slug); if (!resolved || typeof resolved.target_id !== "string") return response({ ok: false, code: "TARGET_UNAVAILABLE" }, 404);
  const token = browser(request); const secret = resolveSupabaseServerSecret()?.value; if (!secret) return response({ ok: false, code: "UNAVAILABLE" }, 503);
  const posts = await eskomiCommunityV11Repository.list(scopeKind === "shop" ? resolved.target_id : null, scopeKind === "area" ? resolved.target_id : null, hmac(secret, `community-browser|${token}`));
  return posts === null ? response({ ok: false, code: "UNAVAILABLE" }, 503) : tagResponse({ ok: true, target: { name: resolved.target_name, scope: scopeKind }, posts }, token);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return response({ ok: false, code: "FORBIDDEN" }, 403);
  const secret = resolveSupabaseServerSecret()?.value; if (!secret) return response({ ok: false, code: "UNAVAILABLE" }, 503);
  let input: Record<string, unknown>; try { input = await request.json(); } catch { return response({ ok: false, code: "INVALID" }, 400); }
  const token = browser(request); const action = input.action;
  if (action === "react") {
    if (typeof input.postId !== "string" || !UUID.test(input.postId) || !Number.isSafeInteger(input.revision) || !["like", "dislike", ""].includes(String(input.value))) return response({ ok: false, code: "INVALID" }, 400);
    const value = await eskomiCommunityV11Repository.rpc("react_to_community_post_v11", { p_post_id: input.postId, p_browser_tag_hash: hmac(secret, `community-browser|${token}`), p_value: input.value, p_expected_revision: input.revision });
    if (isRpcError(value)) return value.code === "54000" ? response({ ok: false, code: "RATE_LIMITED" }, 429) : response({ ok: false, code: "POST_CHANGED" }, 409);
    const result = Array.isArray(value) && value.length === 1 ? value[0] : null;
    return result ? tagResponse({ ok: true, reaction: result }, token) : response({ ok: false, code: "UNAVAILABLE" }, 503);
  }
  if (action === "withdraw") {
    if (typeof input.postId !== "string" || !UUID.test(input.postId) || !Number.isSafeInteger(input.revision) || typeof input.receipt !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(input.receipt)) return response({ ok: false, code: "INVALID" }, 400);
    const value = await eskomiCommunityV11Repository.rpc("withdraw_community_post_v11", { p_post_id: input.postId, p_receipt_hash: hmac(secret, `community-receipt|${input.receipt}`), p_expected_revision: input.revision });
    if (isRpcError(value)) return response({ ok: false, code: "POST_CHANGED" }, 409);
    return value === "withdrawn" ? tagResponse({ ok: true }, token) : response({ ok: false, code: "UNAVAILABLE" }, 503);
  }
  if (action === "withdrawReceipt") {
    if (typeof input.receipt !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(input.receipt)) return response({ ok: false, code: "INVALID" }, 400);
    const value = await eskomiCommunityV11Repository.rpc("withdraw_community_post_by_receipt_v11", { p_receipt_hash: hmac(secret, `community-receipt|${input.receipt}`) });
    if (isRpcError(value)) return response({ ok: false, code: "RECEIPT_UNAVAILABLE" }, 409);
    const result = Array.isArray(value) && value.length === 1 ? value[0] : null;
    return result ? tagResponse({ ok: true, withdrawal: result }, token) : response({ ok: false, code: "UNAVAILABLE" }, 503);
  }
  if (action !== "post" || typeof input.scope !== "string" || typeof input.slug !== "string" || typeof input.body !== "string" || input.body.trim().length < 1 || input.body.trim().length > 400 || typeof input.receipt !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(input.receipt) || typeof input.idempotencyKey !== "string" || !UUID.test(input.idempotencyKey)) return response({ ok: false, code: "INVALID" }, 400);
  const submissionToken = mutationBrowser(request); const resolved = await target(input.scope, input.slug); if (!resolved || typeof resolved.target_id !== "string") return response({ ok: false, code: "TARGET_UNAVAILABLE" }, 404);
  const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";
  const payloadHash = createHash("sha256").update([input.scope, resolved.target_id, input.body.trim()].join("\u001f")).digest("hex");
  const value = await eskomiCommunityV11Repository.rpc("submit_community_post_v11", {
    p_scope_kind: input.scope, p_shop_id: input.scope === "shop" ? resolved.target_id : null, p_area_id: input.scope === "area" ? resolved.target_id : null,
    p_body: input.body, p_receipt_hash: hmac(secret, `community-receipt|${input.receipt}`), p_ip_risk_tag: hmac(secret, `community-ip|${ip}`),
    p_scope_hash: hmac(secret, `community-scope|${submissionToken}|${input.scope}|${resolved.target_id}`), p_idempotency_hash: createHash("sha256").update(input.idempotencyKey).digest("hex"), p_payload_hash: payloadHash
  });
  if (isRpcError(value)) return value.code === "54000" ? response({ ok: false, code: "RATE_LIMITED" }, 429) : response({ ok: false, code: value.code === "22023" ? "REPLAY_MISMATCH" : "TARGET_UNAVAILABLE" }, value.code === "22023" ? 409 : 404);
  const result = Array.isArray(value) && value.length === 1 ? value[0] : null;
  return result ? tagResponse({ ok: true, submission: result, receipt: input.receipt }, token, 201) : response({ ok: false, code: "UNAVAILABLE" }, 503);
}
