const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PARTNER_CONTACT_ROLES = ["owner", "manager", "staff", "authorized_agency"] as const;

export type PartnerRegistrationData = {
  shopSlug: string;
  contactName: string;
  contactRole: (typeof PARTNER_CONTACT_ROLES)[number];
  contactEmail: string;
  confirmationDetails: string;
  sourceUrl: string;
  consentTerms: true;
};

function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength ? value.trim() : null;
}

function httpUrl(value: unknown, maxLength: number): string | null {
  const candidate = text(value, maxLength);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validatePartnerRegistrationPayload(body: unknown):
  | { ok: true; data: PartnerRegistrationData }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "入力内容を確認してください。" };
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.website === "string" && payload.website.trim()) {
    return { ok: false, error: "入力内容を確認してください。" };
  }
  const shopSlug = text(payload.shopSlug, 200);
  const contactName = text(payload.contactName, 80);
  const confirmationDetails = text(payload.confirmationDetails, 2000);
  const sourceUrl = httpUrl(payload.sourceUrl, 2048);
  const contactEmail = text(payload.contactEmail, 254);
  if (!shopSlug || !contactName || !confirmationDetails || !sourceUrl || !contactEmail || !EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "必須項目を確認してください。" };
  }
  if (typeof payload.contactRole !== "string" || !PARTNER_CONTACT_ROLES.includes(payload.contactRole as (typeof PARTNER_CONTACT_ROLES)[number])) {
    return { ok: false, error: "店舗との関係を選択してください。" };
  }
  if (payload.consentTerms !== true) {
    return { ok: false, error: "利用条件と個人情報の取り扱いに同意してください。" };
  }
  return {
    ok: true,
    data: {
      shopSlug,
      contactName,
      contactRole: payload.contactRole as PartnerRegistrationData["contactRole"],
      contactEmail,
      confirmationDetails,
      sourceUrl,
      consentTerms: true,
    },
  };
}
