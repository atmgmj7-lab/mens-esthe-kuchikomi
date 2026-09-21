import type { PartnerMembershipAccess } from "@/lib/partner/partner-auth";

export type PartnerWorkspaceIdentity = Readonly<{
  workspaceId: string;
  shopId: number;
  shopSlug: string;
  shopName: string;
  canonicalUrl: string;
  state: "free_official_partner" | "active_partner";
}>;

export type PartnerDashboardIdentityDependencies = Readonly<{
  getWorkspaceIdentity: (workspaceId: string) => Promise<PartnerWorkspaceIdentity | null>;
}>;

export type PartnerDashboardIdentityResult =
  | Readonly<{ status: "allowed"; identity: PartnerWorkspaceIdentity }>
  | Readonly<{ status: "forbidden" }>;

function isCanonicalIdentity(
  membership: PartnerMembershipAccess,
  identity: PartnerWorkspaceIdentity | null,
): identity is PartnerWorkspaceIdentity {
  return identity !== null
    && identity.workspaceId === membership.workspaceId
    && identity.shopId === membership.shopId
    && identity.shopSlug === membership.shopSlug
    && identity.shopName.trim().length > 0
    && identity.canonicalUrl === `https://mens-esthe-kuchikomi.com/shops/${identity.shopSlug}/`
    && (identity.state === "free_official_partner" || identity.state === "active_partner");
}

export async function resolvePartnerDashboardIdentity(
  membership: PartnerMembershipAccess,
  dependencies: PartnerDashboardIdentityDependencies,
): Promise<PartnerDashboardIdentityResult> {
  try {
    const identity = await dependencies.getWorkspaceIdentity(membership.workspaceId);
    return isCanonicalIdentity(membership, identity)
      ? { status: "allowed", identity }
      : { status: "forbidden" };
  } catch {
    return { status: "forbidden" };
  }
}
