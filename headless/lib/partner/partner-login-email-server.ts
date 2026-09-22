import "server-only";

import { normalizePartnerLoginEmail } from "@/lib/partner/partner-login-email";

type Environment = Readonly<Record<string, string | undefined>>;

function configuredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function configuredSupabaseAuth(environment: Environment): Readonly<{ baseUrl: string; publishableKey: string }> | null {
  const rawUrl = configuredString(environment.SUPABASE_URL);
  const publishableKey = configuredString(environment.SUPABASE_AUTH_PUBLISHABLE_KEY);
  if (!rawUrl || !publishableKey) return null;
  try {
    const url = new URL(rawUrl);
    const localHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if ((!localHttp && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) return null;
    return { baseUrl: url.toString().replace(/\/$/, ""), publishableKey };
  } catch {
    return null;
  }
}

/** Uses the signed-in Partner token only; this is never an admin Auth update. */
export function createPartnerAuthenticatedEmailClient(environment: Environment, fetchImpl: typeof fetch = fetch) {
  const auth = configuredSupabaseAuth(environment);
  if (!auth) return null;

  return {
    async requestEmailChange(accessToken: string, requestedEmail: string): Promise<string | null> {
      const email = normalizePartnerLoginEmail(requestedEmail);
      if (!email || typeof accessToken !== "string" || !accessToken || accessToken.length > 8_192) return null;
      try {
        const response = await fetchImpl(`${auth.baseUrl}/auth/v1/user`, {
          method: "PUT",
          headers: {
            apikey: auth.publishableKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
          cache: "no-store",
        });
        if (!response.ok) return null;
        const body = await response.json() as unknown;
        if (!body || typeof body !== "object" || Array.isArray(body)) return email;
        const pending = (body as Record<string, unknown>).new_email;
        return normalizePartnerLoginEmail(pending) ?? email;
      } catch {
        return null;
      }
    },
  };
}
