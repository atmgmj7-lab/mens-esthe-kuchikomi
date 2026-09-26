import "server-only";

type Environment = Readonly<Record<string, string | undefined>>;

const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export type SupabaseServerSecret = Readonly<{
  value: string;
  source: "SUPABASE_SECRET_KEY" | "SUPABASE_SERVICE_ROLE_KEY";
  type: "MODERN_SECRET" | "LEGACY_JWT" | "OTHER";
}>;

function configuredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveSupabaseServerSecret(environment: Environment = process.env): SupabaseServerSecret | null {
  const modern = configuredString(environment.SUPABASE_SECRET_KEY);
  const legacyFallback = configuredString(environment.SUPABASE_SERVICE_ROLE_KEY);
  const value = modern ?? legacyFallback;
  if (!value) return null;

  return {
    value,
    source: modern ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY",
    type: value.startsWith("sb_secret_")
      ? "MODERN_SECRET"
      : LEGACY_SERVICE_ROLE_JWT_RE.test(value)
        ? "LEGACY_JWT"
        : "OTHER",
  };
}

export function createSupabaseServerHeaders(
  secretValue: string,
  additionalHeaders: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const headers: Record<string, string> = { apikey: secretValue, ...additionalHeaders };
  if (LEGACY_SERVICE_ROLE_JWT_RE.test(secretValue)) headers.Authorization = `Bearer ${secretValue}`;
  return headers;
}
