import { createHmac } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

export type ShopOwnerRateLimitClaim =
  | { ok: true; allowed: true }
  | { ok: true; allowed: false; retryAfterSec: number }
  | { ok: false; reason: "not-configured" | "request-failed" };

const LEGACY_SERVICE_ROLE_JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const RATE_LIMIT_WINDOW_SECONDS = 600;

function firstValidIp(value: string | null): string | null {
  if (!value) return null;
  for (const candidate of value.split(",")) {
    const normalized = candidate.trim();
    if (isIP(normalized)) return normalized;
  }
  return null;
}

export function resolveTrustedShopOwnerClientIp(headers: HeaderReader): string | null {
  for (const name of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const ip = firstValidIp(headers.get(name));
    if (ip) return ip;
  }
  return null;
}

export function buildShopOwnerRequestRateLimitKey({
  shopId,
  requesterEmail,
  clientIp,
  secret,
}: {
  shopId: number;
  requesterEmail: string;
  clientIp: string | null;
  secret: string;
}): string {
  const visitorScope = clientIp
    ? `ip:${clientIp}`
    : `email:${requesterEmail.trim().toLowerCase()}`;
  return createHmac("sha256", secret)
    .update(`${visitorScope}|shop:${shopId}`)
    .digest("hex");
}

export async function claimShopOwnerRequestRateLimit({
  shopId,
  requesterEmail,
  clientIp,
}: {
  shopId: number;
  requesterEmail: string;
  clientIp: string | null;
}): Promise<ShopOwnerRateLimitClaim> {
  if (
    process.env.SHOP_OWNER_REQUEST_DRY_RUN === "true"
    && process.env.NODE_ENV !== "production"
  ) {
    return { ok: true, allowed: true };
  }

  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rateLimitSecret = process.env.SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET;
  if (!baseUrl || !serviceKey || !rateLimitSecret) {
    return { ok: false, reason: "not-configured" };
  }

  const requestKey = buildShopOwnerRequestRateLimitKey({
    shopId,
    requesterEmail,
    clientIp,
    secret: rateLimitSecret,
  });
  const headers: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
    "Content-Profile": "api",
    "Accept-Profile": "api",
  };
  if (LEGACY_SERVICE_ROLE_JWT_RE.test(serviceKey)) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }

  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/rpc/claim_shop_owner_request_rate_limit`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ p_request_key: requestKey }),
        cache: "no-store",
      },
    );
    if (!response.ok) return { ok: false, reason: "request-failed" };

    const allowed = await response.json();
    return allowed === true
      ? { ok: true, allowed: true }
      : { ok: true, allowed: false, retryAfterSec: RATE_LIMIT_WINDOW_SECONDS };
  } catch {
    return { ok: false, reason: "request-failed" };
  }
}
