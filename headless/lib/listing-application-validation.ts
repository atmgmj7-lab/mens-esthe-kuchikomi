export type ListingApplicationInput = Readonly<{
  idempotencyKey: string; kind: "new_listing" | "existing_change"; existingWpShopId?: number; existingShopSlug?: string;
  shopName: string; area: string; websiteUrl: string; introduction?: string;
  contactName: string; contactEmail: string; contactRole: "owner" | "manager" | "staff" | "authorized-agency";
  editPreference: "operator" | "shop"; consentPrivacy: true; consentAccuracy: true; consentImageRights: true;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;
const url = (v: unknown) => { try { const value = text(v, 2048); if (!value) return null; const parsed = new URL(value); return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null; } catch { return null; } };

export function validateListingApplication(value: unknown): { ok: true; data: ListingApplicationInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "入力内容を確認してください。" };
  const p = value as Record<string, unknown>;
  const kind = p.kind === "new_listing" || p.kind === "existing_change" ? p.kind : null;
  const shopName = text(p.shopName, 120); const area = text(p.area, 120); const websiteUrl = url(p.websiteUrl);
  const contactName = text(p.contactName, 80); const contactEmail = text(p.contactEmail, 254);
  const contactRole = ["owner","manager","staff","authorized-agency"].includes(String(p.contactRole)) ? p.contactRole as ListingApplicationInput["contactRole"] : null;
  const editPreference = p.editPreference === "operator" || p.editPreference === "shop" ? p.editPreference : null;
  if (!UUID.test(String(p.idempotencyKey)) || !kind || !shopName || !area || !websiteUrl || !contactName || !contactEmail || !email.test(contactEmail) || !contactRole || !editPreference) return { ok: false, error: "必須項目を確認してください。" };
  if (p.consentPrivacy !== true || p.consentAccuracy !== true || p.consentImageRights !== true) return { ok: false, error: "必要な同意を確認してください。" };
  const existingWpShopId = Number(p.existingWpShopId); const existingShopSlug = text(p.existingShopSlug, 200);
  if (kind === "existing_change" && (!Number.isSafeInteger(existingWpShopId) || existingWpShopId <= 0 || !existingShopSlug)) return { ok: false, error: "掲載済み店舗を確認してください。" };
  const existing = kind === "existing_change" ? { existingWpShopId, existingShopSlug: existingShopSlug as string } : {};
  return { ok: true, data: { idempotencyKey: String(p.idempotencyKey), kind, ...existing, shopName, area, websiteUrl, ...(text(p.introduction, 5000) ? { introduction: text(p.introduction, 5000)! } : {}), contactName, contactEmail, contactRole, editPreference, consentPrivacy: true, consentAccuracy: true, consentImageRights: true } };
}
