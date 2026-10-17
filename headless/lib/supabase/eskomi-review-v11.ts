import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rpc(name: string, values: Record<string, unknown>) {
  const secret = resolveSupabaseServerSecret()?.value;
  if (!secret || !process.env.SUPABASE_URL) return null;
  try {
    const origin = process.env.SUPABASE_URL.replace(/\/$/, ""); const parsed = new URL(origin);
    const endpoint = ["127.0.0.1", "localhost"].includes(parsed.hostname) ? `${origin}/rpc/${name}` : `${origin}/rest/v1/rpc/${name}`;
    const response = await fetch(endpoint, { method: "POST", headers: createSupabaseServerHeaders(secret, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }), body: JSON.stringify(values), cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

export const eskomiReviewV11Repository = {
  async context(entryHandle: string, sessionHash: string, fingerprint: string, therapistAssignmentId: string | null = null) {
    if (!UUID.test(entryHandle)) return null;
    if (therapistAssignmentId !== null && !UUID.test(therapistAssignmentId)) return null;
    const value = await rpc("create_review_submission_context", { p_entry_handle: entryHandle, p_session_secret_hash: sessionHash, p_context_fingerprint: fingerprint, p_therapist_assignment_id: therapistAssignmentId });
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
  async therapists(entryHandle: string) {
    if (!UUID.test(entryHandle)) return null;
    const value = await rpc("list_review_entry_therapists", { p_entry_handle: entryHandle });
    return Array.isArray(value) ? value.filter((item): item is { id: string; display_name: string } => typeof item?.id === "string" && UUID.test(item.id) && typeof item.display_name === "string") : null;
  },
  async submit(values: Record<string, unknown>) {
    const value = await rpc("submit_review_experience_v11", values);
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
  async benefitReceipt(experienceId: string, sessionHash: string) {
    if (!UUID.test(experienceId)) return null;
    const value = await rpc("get_review_benefit_receipt_v11", { p_experience_id: experienceId, p_session_secret_hash: sessionHash });
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
  async editSession(receiptHash: string, sessionHash: string, fingerprint: string) {
    const value = await rpc("open_review_edit_session", { p_receipt_hash: receiptHash, p_session_secret_hash: sessionHash, p_context_fingerprint: fingerprint });
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
  async recordIpBurst(ipEntryHash: string, idempotencyHash: string) {
    return rpc("record_review_ip_burst_signal", { p_ip_entry_hash: ipEntryHash, p_idempotency_hash: idempotencyHash });
  },
  async storeReplay(sessionHash: string, idempotencyHash: string, ciphertext: string, nonce: string) {
    return rpc("store_review_secret_replay", { p_session_hash: sessionHash, p_idempotency_hash: idempotencyHash, p_ciphertext: ciphertext, p_nonce: nonce, p_key_version: "test-v1" });
  },
  async fetchReplay(sessionHash: string, idempotencyHash: string) {
    const value = await rpc("fetch_review_secret_replay", { p_session_hash: sessionHash, p_idempotency_hash: idempotencyHash });
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
};
