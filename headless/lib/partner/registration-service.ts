import "server-only";

import { normalizePublicShopSlug } from "@/lib/shop-slug";
import type { PartnerRegistrationData } from "@/lib/partner/registration-validation";
import { provisionPartnerWorkspace, type CanonicalPartnerShop, type PartnerWorkspace, type PartnerWorkspaceRepository } from "@/lib/partner/provisioning-service";

type RateLimitResult = { ok: true; allowed: true } | { ok: true; allowed: false; retryAfterSec: number } | { ok: false };

export type PartnerRegistrationDependencies = {
  getShopBySlug: (slug: string) => Promise<CanonicalPartnerShop | null>;
  claimRateLimit: (input: { shopId: number; requesterEmail: string; clientIp: string | null }) => Promise<RateLimitResult>;
  workspaceRepository: PartnerWorkspaceRepository;
  saveRegistration: (input: { workspaceId: string; data: PartnerRegistrationData }) => Promise<{ ok: true; state: PartnerWorkspace["state"] } | { ok: false }>;
};

export async function submitPartnerRegistration(
  data: PartnerRegistrationData,
  clientIp: string | null,
  dependencies: PartnerRegistrationDependencies,
): Promise<{ ok: true; workspace: PartnerWorkspace; state: PartnerWorkspace["state"] } | { ok: false; reason: "shop-mismatch" | "rate-limited" | "unavailable" }> {
  let shop: CanonicalPartnerShop | null;
  try {
    shop = await dependencies.getShopBySlug(data.shopSlug);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const submittedSlug = normalizePublicShopSlug(data.shopSlug);
  const canonicalSlug = shop ? normalizePublicShopSlug(shop.slug) : "";
  if (!shop || !submittedSlug || canonicalSlug !== submittedSlug) {
    return { ok: false, reason: "shop-mismatch" };
  }

  const rateLimit = await dependencies.claimRateLimit({
    shopId: shop.id,
    requesterEmail: data.contactEmail,
    clientIp,
  }).catch(() => ({ ok: false } as const));
  if (!rateLimit.ok) return { ok: false, reason: "unavailable" };
  if (!rateLimit.allowed) return { ok: false, reason: "rate-limited" };

  const workspace = await provisionPartnerWorkspace(shop, "self_registration", dependencies.workspaceRepository);
  if (!workspace) return { ok: false, reason: "unavailable" };
  const saved = await dependencies.saveRegistration({ workspaceId: workspace.id, data });
  return saved.ok ? { ok: true, workspace, state: saved.state } : { ok: false, reason: "unavailable" };
}
