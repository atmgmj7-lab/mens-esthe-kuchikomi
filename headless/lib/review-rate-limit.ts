type RateEntry = { count: number; resetAt: number };

const store = new Map<string, RateEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;

export function checkReviewRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const key = `review:${ip}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
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
export function _resetReviewRateLimitStore(): void {
  store.clear();
}
