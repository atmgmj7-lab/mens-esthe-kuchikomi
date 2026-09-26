import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { secretsMatch } from "@/lib/server/secure-secret";
import { resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

type Environment = Readonly<Record<string, string | undefined>>;

const PARTNER_LOGIN_STATE_RE = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

function normalizedLoginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function binding(nonce: string, email: string, secret: string) {
  return createHmac("sha256", secret)
    .update("eskomi-partner-login-v1\0")
    .update(nonce)
    .update("\0")
    .update(email)
    .digest("base64url");
}

export function createPartnerLoginState(emailValue: unknown, environment: Environment): string | null {
  const email = normalizedLoginEmail(emailValue);
  const secret = resolveSupabaseServerSecret(environment)?.value ?? null;
  if (!email || !secret) return null;
  const nonce = randomBytes(32).toString("base64url");
  return `${nonce}.${binding(nonce, email, secret)}`;
}

export function partnerLoginStateMatchesEmail(state: unknown, emailValue: unknown, environment: Environment): boolean {
  const email = normalizedLoginEmail(emailValue);
  const secret = resolveSupabaseServerSecret(environment)?.value ?? null;
  const match = typeof state === "string" ? PARTNER_LOGIN_STATE_RE.exec(state) : null;
  if (!email || !secret || !match) return false;
  return secretsMatch(match[2], binding(match[1], email, secret));
}
