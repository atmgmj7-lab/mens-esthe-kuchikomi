export const PARTNER_LOGIN_EMAIL_INTENT_KINDS = [
  "operator_initial",
  "operator_change_requested",
  "partner_change_requested",
] as const;

export type PartnerLoginEmailIntentKind = (typeof PARTNER_LOGIN_EMAIL_INTENT_KINDS)[number];

export type PartnerLoginEmailManagement = Readonly<{
  status: "available" | "not_set" | "unavailable" | "identity_mismatch" | "forbidden";
  workspaceId: string | null;
  authUserId: string | null;
  email: string | null;
  intent: PartnerLoginEmailIntentKind | null;
  updatedAt: string | null;
}>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes only a user-entered login address. It intentionally does not
 * infer a Workspace, Membership, or Auth user from that address.
 */
export function normalizePartnerLoginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLocaleLowerCase("en-US");
  return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function isPartnerLoginEmailIntentKind(value: unknown): value is PartnerLoginEmailIntentKind {
  return typeof value === "string" && (PARTNER_LOGIN_EMAIL_INTENT_KINDS as readonly string[]).includes(value);
}
