import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rpc(name: string, values: Record<string, unknown>) {
  const secret = resolveSupabaseServerSecret()?.value;
  if (!secret || !process.env.SUPABASE_URL) return null;
  try {
    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${name}`, { method: "POST", headers: createSupabaseServerHeaders(secret, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }), body: JSON.stringify(values), cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

export const eskomiReviewV11Repository = {
  async context(entryHandle: string, sessionHash: string, fingerprint: string) {
    if (!UUID.test(entryHandle)) return null;
    const value = await rpc("create_review_submission_context", { p_entry_handle: entryHandle, p_session_secret_hash: sessionHash, p_context_fingerprint: fingerprint });
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
  async submit(values: Record<string, unknown>) {
    const value = await rpc("submit_review_experience_v11", values);
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
  async editSession(receiptHash: string, sessionHash: string, fingerprint: string) {
    const value = await rpc("open_review_edit_session", { p_receipt_hash: receiptHash, p_session_secret_hash: sessionHash, p_context_fingerprint: fingerprint });
    return Array.isArray(value) && value.length === 1 ? value[0] as Record<string, unknown> : null;
  },
};
