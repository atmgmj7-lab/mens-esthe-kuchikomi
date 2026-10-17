export type PartnerAuthUser = Readonly<{ id: string; email: string | null }>;
export type PartnerMembershipAccess = Readonly<{
  workspaceId: string;
  identityKind: "canonical";
  appShopId: string;
  shopSlug: string;
  role: "owner" | "manager";
}> | Readonly<{
  workspaceId: string;
  identityKind: "legacy";
  wpShopId: number;
  shopSlug: string;
  role: "owner" | "manager";
}>;
export type PartnerAccessDependencies = Readonly<{
  getUser: (accessToken: string) => Promise<PartnerAuthUser | null>;
  getActiveMembership: (authUserId: string) => Promise<PartnerMembershipAccess | null>;
}>;
export type PartnerAccessResult =
  | Readonly<{ status: "allowed"; access: PartnerMembershipAccess }>
  | Readonly<{ status: "unauthenticated" | "forbidden" }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validWorkspaceId(value: string | null): boolean {
  return value === null || UUID_RE.test(value);
}

function validRequestedShopId(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value > 0);
}

function validMembership(value: PartnerMembershipAccess | null): value is PartnerMembershipAccess {
  return value !== null
    && UUID_RE.test(value.workspaceId)
    && value.shopSlug.length > 0
    && (value.role === "owner" || value.role === "manager")
    && ((value.identityKind === "canonical" && UUID_RE.test(value.appShopId))
      || (value.identityKind === "legacy" && Number.isSafeInteger(value.wpShopId) && value.wpShopId > 0));
}

export async function authorizePartnerAccess(
  input: Readonly<{ accessToken: string | null; requestedWorkspaceId: string | null; requestedShopId: number | null }>,
  dependencies: PartnerAccessDependencies,
): Promise<PartnerAccessResult> {
  if (!input.accessToken || !validWorkspaceId(input.requestedWorkspaceId)
    || !validRequestedShopId(input.requestedShopId)) {
    return { status: "unauthenticated" };
  }

  let user: PartnerAuthUser | null;
  try {
    user = await dependencies.getUser(input.accessToken);
  } catch {
    return { status: "unauthenticated" };
  }
  if (!user || !UUID_RE.test(user.id)) return { status: "unauthenticated" };

  let membership: PartnerMembershipAccess | null;
  try {
    membership = await dependencies.getActiveMembership(user.id);
  } catch {
    return { status: "forbidden" };
  }
  if (!validMembership(membership)) return { status: "forbidden" };

  if (input.requestedWorkspaceId !== null && input.requestedWorkspaceId.toLowerCase() !== membership.workspaceId.toLowerCase()) {
    return { status: "forbidden" };
  }
  if ((membership.identityKind === "canonical" && input.requestedShopId !== null)
    || (membership.identityKind === "legacy" && input.requestedShopId !== null && input.requestedShopId !== membership.wpShopId)) {
    return { status: "forbidden" };
  }

  return { status: "allowed", access: membership };
}
