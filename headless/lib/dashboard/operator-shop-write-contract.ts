export const WORDPRESS_WRITER_MAPPING_REQUIRED = "WORDPRESS_WRITER_MAPPING_REQUIRED";

export const LISTING_EXCLUSION_REASONS = [
  "out_of_scope_industry",
  "closed_confirmed",
  "duplicate",
  "identity_mismatch",
  "other",
] as const;

export type ListingExclusionReason = (typeof LISTING_EXCLUSION_REASONS)[number];
export type OperatorShopPublicationState = "publish" | "draft" | "private" | "excluded";

export type OperatorShopDraft = Readonly<{
  title: string;
  area: string;
  officialUrl: string;
  address: string;
  businessHours: string;
  phone: string;
  lineUrl: string;
  bookingUrl: string;
  basicPrice: string;
  publicationState: OperatorShopPublicationState;
}>;

export type OperatorShopWriteIntent = Readonly<{
  kind: "create" | "update" | "listing_exclusion";
  wpShopId: number | null;
  draft: OperatorShopDraft | null;
  exclusionReason: ListingExclusionReason | null;
  writerStatus: typeof WORDPRESS_WRITER_MAPPING_REQUIRED;
}>;

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isUrlOrBlank(value: string): boolean {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateOperatorShopDraft(input: OperatorShopDraft): { ok: true; value: OperatorShopDraft } | { ok: false; message: string } {
  const value = {
    ...input,
    title: clean(input.title),
    area: clean(input.area),
    officialUrl: clean(input.officialUrl),
    address: clean(input.address),
    businessHours: clean(input.businessHours),
    phone: clean(input.phone),
    lineUrl: clean(input.lineUrl),
    bookingUrl: clean(input.bookingUrl),
    basicPrice: clean(input.basicPrice),
  };
  if (!value.title || value.title.length > 120) return { ok: false, message: "店舗名を1〜120文字で入力してください。" };
  if (!value.area || value.area.length > 80) return { ok: false, message: "エリアを1〜80文字で入力してください。" };
  if (!isUrlOrBlank(value.officialUrl) || !isUrlOrBlank(value.lineUrl) || !isUrlOrBlank(value.bookingUrl)) {
    return { ok: false, message: "URLは http:// または https:// で入力してください。" };
  }
  return { ok: true, value };
}

export function createOperatorShopWriteIntent(
  kind: "create" | "update",
  draft: OperatorShopDraft,
  wpShopId: number | null,
): OperatorShopWriteIntent | { ok: false; message: string } {
  const validated = validateOperatorShopDraft(draft);
  if (!validated.ok) return validated;
  if (kind === "update" && (!Number.isSafeInteger(wpShopId) || (wpShopId ?? 0) <= 0)) {
    return { ok: false, message: "更新対象のWordPress店舗IDを確認してください。" };
  }
  return { kind, wpShopId, draft: validated.value, exclusionReason: null, writerStatus: WORDPRESS_WRITER_MAPPING_REQUIRED };
}

export function createListingExclusionIntent(
  wpShopId: number,
  exclusionReason: ListingExclusionReason,
): OperatorShopWriteIntent | { ok: false; message: string } {
  if (!Number.isSafeInteger(wpShopId) || wpShopId <= 0) return { ok: false, message: "対象のWordPress店舗IDを確認してください。" };
  if (!LISTING_EXCLUSION_REASONS.includes(exclusionReason)) return { ok: false, message: "掲載対象外の理由を選択してください。" };
  return { kind: "listing_exclusion", wpShopId, draft: null, exclusionReason, writerStatus: WORDPRESS_WRITER_MAPPING_REQUIRED };
}
