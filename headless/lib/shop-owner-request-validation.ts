import { normalizePublicShopSlug } from "@/lib/shop-slug";

export const SHOP_OWNER_REQUEST_FIELDS = [
  "price",
  "hours",
  "access",
  "reservation",
  "introduction",
  "features",
  "official-image",
  "other",
] as const;

export const SHOP_OWNER_REQUEST_ROLES = [
  "owner",
  "manager",
  "staff",
  "authorized-agency",
] as const;

export type ShopOwnerRequestData = {
  shopId: number;
  shopSlug: string;
  shopName: string;
  targetUrl: string;
  sourceUrl: string;
  requesterName: string;
  requesterRole: (typeof SHOP_OWNER_REQUEST_ROLES)[number];
  requesterEmail: string;
  requestedFields: Array<(typeof SHOP_OWNER_REQUEST_FIELDS)[number]>;
  changeDetails: string;
  evidenceUrl?: string;
  officialImageUrl?: string;
  consentPrivacy: true;
  consentAccuracy: true;
  consentImageRights: true;
};

export type ShopOwnerRequestValidation =
  | { ok: true; data: ShopOwnerRequestData }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeHttpUrl(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function optionalHttpUrl(
  value: unknown,
  maxLength: number,
): { ok: true; value?: string } | { ok: false } {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value === "string" && !value.trim()) return { ok: true };

  const url = safeHttpUrl(value, maxLength);
  return url ? { ok: true, value: url } : { ok: false };
}

function invalid(error: string): ShopOwnerRequestValidation {
  return { ok: false, error };
}

export function validateShopOwnerRequestPayload(body: unknown): ShopOwnerRequestValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid("入力内容を確認してください。");
  }

  const payload = body as Record<string, unknown>;
  const website = payload.website;
  if (
    website !== undefined
    && website !== null
    && (typeof website !== "string" || website.trim() !== "")
  ) {
    return invalid("入力内容を確認してください。");
  }

  if (!Number.isSafeInteger(payload.shopId) || (payload.shopId as number) <= 0) {
    return invalid("店舗情報を確認してください。");
  }

  const shopSlug = normalizePublicShopSlug(
    typeof payload.shopSlug === "string" ? payload.shopSlug.trim() : "",
  );
  if (!shopSlug) {
    return invalid("店舗URLの情報を確認してください。");
  }

  const shopName = requiredText(payload.shopName, 120);
  if (!shopName) {
    return invalid("店舗名を120文字以内で入力してください。");
  }

  const targetUrlInput = typeof payload.targetUrl === "string"
    ? payload.targetUrl.trim()
    : "";
  const targetUrl = safeHttpUrl(targetUrlInput, 500);
  const canonicalTargetUrl = `https://mens-esthe-kuchikomi.com/shops/${shopSlug}/`;
  if (!targetUrl || targetUrlInput !== canonicalTargetUrl || targetUrl !== canonicalTargetUrl) {
    return invalid("対象店舗URLを確認してください。");
  }

  const sourceUrl = safeHttpUrl(payload.sourceUrl, 2048);
  if (!sourceUrl) {
    return invalid("遷移元URLを確認してください。");
  }

  const requesterName = requiredText(payload.requesterName, 80);
  if (!requesterName) {
    return invalid("お名前を80文字以内で入力してください。");
  }

  if (
    typeof payload.requesterRole !== "string"
    || !SHOP_OWNER_REQUEST_ROLES.includes(
      payload.requesterRole as (typeof SHOP_OWNER_REQUEST_ROLES)[number],
    )
  ) {
    return invalid("店舗との関係を選択してください。");
  }

  const requesterEmail = typeof payload.requesterEmail === "string"
    ? payload.requesterEmail.trim()
    : "";
  if (
    requesterEmail.length < 3
    || requesterEmail.length > 254
    || !EMAIL_RE.test(requesterEmail)
  ) {
    return invalid("メールアドレスを確認してください。");
  }

  if (!Array.isArray(payload.requestedFields) || payload.requestedFields.length === 0) {
    return invalid("修正する項目を1つ以上選択してください。");
  }
  if (
    payload.requestedFields.some(
      (field) => typeof field !== "string"
        || !SHOP_OWNER_REQUEST_FIELDS.includes(
          field as (typeof SHOP_OWNER_REQUEST_FIELDS)[number],
        ),
    )
  ) {
    return invalid("修正する項目を確認してください。");
  }
  const requestedFields = Array.from(new Set(payload.requestedFields)) as ShopOwnerRequestData["requestedFields"];

  const changeDetails = requiredText(payload.changeDetails, 5000);
  if (!changeDetails) {
    return invalid("変更内容を5000文字以内で入力してください。");
  }

  const evidenceUrl = optionalHttpUrl(payload.evidenceUrl, 500);
  if (!evidenceUrl.ok) {
    return invalid("根拠となるURLを確認してください。");
  }

  const officialImageUrl = optionalHttpUrl(payload.officialImageUrl, 500);
  if (!officialImageUrl.ok) {
    return invalid("公式画像URLを確認してください。");
  }

  if (payload.consentPrivacy !== true) {
    return invalid("個人情報の取り扱いに同意してください。");
  }
  if (payload.consentAccuracy !== true) {
    return invalid("情報の正確性を確認してください。");
  }
  if (payload.consentImageRights !== true) {
    return invalid("画像の掲載権限を確認してください。");
  }

  return {
    ok: true,
    data: {
      shopId: payload.shopId as number,
      shopSlug,
      shopName,
      targetUrl,
      sourceUrl,
      requesterName,
      requesterRole: payload.requesterRole as ShopOwnerRequestData["requesterRole"],
      requesterEmail,
      requestedFields,
      changeDetails,
      ...(evidenceUrl.value ? { evidenceUrl: evidenceUrl.value } : {}),
      ...(officialImageUrl.value ? { officialImageUrl: officialImageUrl.value } : {}),
      consentPrivacy: true,
      consentAccuracy: true,
      consentImageRights: true,
    },
  };
}
