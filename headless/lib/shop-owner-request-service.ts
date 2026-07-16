import { normalizePublicShopSlug } from "@/lib/shop-slug";
import type { ShopOwnerRequestData } from "@/lib/shop-owner-request-validation";

type CanonicalShop = {
  id: number;
  slug: string;
  title: string;
};

type RateLimitResult =
  | { ok: true; allowed: true }
  | { ok: true; allowed: false; retryAfterSec: number }
  | { ok: false; reason: string };

type SaveResult = { ok: true } | { ok: false; reason: string };

export type ShopOwnerRequestSubmissionResult =
  | { ok: true }
  | { ok: false; reason: "shop-mismatch" | "source-unavailable" }
  | { ok: false; reason: "rate-limited"; retryAfterSec: number }
  | { ok: false; reason: "rate-limit-unavailable" | "save-failed" };

export type ShopOwnerRequestSubmissionDependencies = {
  getShopBySlug: (slug: string) => Promise<CanonicalShop | null>;
  claimRateLimit: (input: {
    shopId: number;
    requesterEmail: string;
    clientIp: string | null;
  }) => Promise<RateLimitResult>;
  save: (data: ShopOwnerRequestData) => Promise<SaveResult>;
};

export async function submitCanonicalShopOwnerRequest(
  submitted: ShopOwnerRequestData,
  context: { clientIp: string | null },
  dependencies: ShopOwnerRequestSubmissionDependencies,
): Promise<ShopOwnerRequestSubmissionResult> {
  let canonicalShop: CanonicalShop | null;
  try {
    canonicalShop = await dependencies.getShopBySlug(submitted.shopSlug);
  } catch {
    return { ok: false, reason: "source-unavailable" };
  }

  if (!canonicalShop) {
    return { ok: false, reason: "shop-mismatch" };
  }

  const canonicalSlug = normalizePublicShopSlug(canonicalShop.slug);
  const canonicalName = canonicalShop.title.trim();
  if (
    canonicalShop.id !== submitted.shopId
    || canonicalSlug !== submitted.shopSlug
    || !canonicalName
    || canonicalName.length > 120
  ) {
    return { ok: false, reason: "shop-mismatch" };
  }

  const canonicalData: ShopOwnerRequestData = {
    ...submitted,
    shopId: canonicalShop.id,
    shopSlug: canonicalSlug,
    shopName: canonicalName,
    targetUrl: `https://mens-esthe-kuchikomi.com/shops/${canonicalSlug}/`,
  };

  let rateLimit: RateLimitResult;
  try {
    rateLimit = await dependencies.claimRateLimit({
      shopId: canonicalData.shopId,
      requesterEmail: canonicalData.requesterEmail,
      clientIp: context.clientIp,
    });
  } catch {
    return { ok: false, reason: "rate-limit-unavailable" };
  }
  if (!rateLimit.ok) {
    return { ok: false, reason: "rate-limit-unavailable" };
  }
  if (!rateLimit.allowed) {
    return {
      ok: false,
      reason: "rate-limited",
      retryAfterSec: rateLimit.retryAfterSec,
    };
  }

  try {
    const saved = await dependencies.save(canonicalData);
    return saved.ok
      ? { ok: true }
      : { ok: false, reason: "save-failed" };
  } catch {
    return { ok: false, reason: "save-failed" };
  }
}
