import "server-only";

import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

async function rpc(name: string, values: Record<string, unknown>) {
  const secret = resolveSupabaseServerSecret()?.value;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!secret || !base) return null;
  try {
    const parsed = new URL(base);
    const endpoint = ["127.0.0.1", "localhost"].includes(parsed.hostname) ? `${base}/rpc/${name}` : `${base}/rest/v1/rpc/${name}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: createSupabaseServerHeaders(secret, { "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }),
      body: JSON.stringify(values), cache: "no-store"
    });
    if (response.ok) return await response.json();
    const error = await response.json().catch(() => null) as { code?: unknown } | null;
    return { __rpc_error: true, code: typeof error?.code === "string" ? error.code : null };
  } catch { return null; }
}

function one(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value.length === 1 && typeof value[0] === "object" && value[0] !== null ? value[0] as Record<string, unknown> : null;
}

export const eskomiCommunityV11Repository = {
  rpc,
  async target(scopeKind: "shop" | "area", slug: string) {
    return one(await rpc("resolve_public_community_target_v11", { p_scope_kind: scopeKind, p_slug: slug }));
  },
  async list(shopId: string | null, areaId: string | null, browserTagHash: string) {
    const value = await rpc("list_public_community_posts_v11", { p_shop_id: shopId, p_area_id: areaId, p_browser_tag_hash: browserTagHash });
    return Array.isArray(value) ? value : null;
  }
};
