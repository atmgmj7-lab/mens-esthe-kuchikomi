type RateEntry = { count: number; resetAt: number };

const store = new Map<string, RateEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true };
}

/** Test helper – not used in production routes */
export function _resetRateLimitStore(): void {
  store.clear();
}
