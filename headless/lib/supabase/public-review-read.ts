export type PublicReviewRpcName =
  | "list_public_review_experience_publications_global"
  | "count_public_review_experience_publications_global"
  | "list_public_shop_detail_reviews_v11"
  | "get_public_shop_detail_review_summary_v11";

export type PublicReviewReadTransport = Readonly<{ origin: string; key: string }>;
type Environment = Readonly<Record<string, string | undefined>>;

function requested(environment: Environment): boolean {
  return environment.CONTENT_DATA_SOURCE?.trim().toLowerCase() === "supabase"
    || environment.REVIEW_READ_SOURCE?.trim().toLowerCase() === "supabase"
    || environment.ESKOMI_V11_PUBLIC_REVIEW_SOURCE?.trim().toLowerCase() === "supabase";
}

function origin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null;
  } catch { return null; }
}

export function resolvePublicReviewReadTransport(environment: Environment = process.env): PublicReviewReadTransport | null {
  if (!requested(environment)) return null;
  const base = origin(environment.SUPABASE_CONTENT_URL);
  const key = environment.SUPABASE_CONTENT_PUBLISHABLE_KEY?.trim();
  return base && key ? { origin: base, key } : null;
}

export async function requestPublicReviewRpc(
  transport: PublicReviewReadTransport, name: PublicReviewRpcName, payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  try {
    const response = await fetchImpl(`${transport.origin}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: transport.key, Authorization: `Bearer ${transport.key}`, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
      body: JSON.stringify(payload), cache: "no-store",
    });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
