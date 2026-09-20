export const USED_PERIODS = [
  "今月",
  "1〜3ヶ月以内",
  "半年以内",
  "1年以内",
  "それ以前"
] as const;

export type UsedPeriod = (typeof USED_PERIODS)[number];

export type ReviewSubmitPayload = {
  shopSlug: string;
  nickname: string;
  usedPeriod: UsedPeriod;
  ratingTotal: number;
  ratingPrice?: number;
  ratingService?: number;
  ratingCleanliness?: number;
  revisitIntent?: string;
  reviewBody: string;
  website?: string;
  campaignToken?: string;
};

const LIMITS = {
  nickname: 30,
  reviewBodyMin: 30,
  reviewBodyMax: 1000,
  revisitIntent: 80,
  website: 200,
  shopSlug: 200
} as const;

export const ALLOWED_REVIEW_PAYLOAD_KEYS = [
  "shopSlug",
  "nickname",
  "usedPeriod",
  "ratingTotal",
  "ratingPrice",
  "ratingService",
  "ratingCleanliness",
  "revisitIntent",
  "reviewBody",
  "website",
  "campaignToken",
] as const;

const ALLOWED_REVIEW_PAYLOAD_KEY_SET = new Set<string>(ALLOWED_REVIEW_PAYLOAD_KEYS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const HTML_TAG_RE = /<[^>]*>/g;

export type ReviewValidationResult =
  | { ok: true; data: ReviewSubmitPayload }
  | { ok: false; error: string };

function stripHtml(value: string): string {
  return value.replace(HTML_TAG_RE, "").trim();
}

function parseOptionalRating(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "number") return undefined;
  const num = value;
  if (!Number.isInteger(num) || num < 1 || num > 5) {
    return undefined;
  }
  return num;
}

function parseRequiredRating(value: unknown): number | null {
  if (typeof value !== "number") return null;
  const num = value;
  if (!Number.isInteger(num) || num < 1 || num > 5) {
    return null;
  }
  return num;
}

export function validateReviewPayload(body: unknown): ReviewValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "リクエスト形式が正しくありません。" };
  }

  const raw = body as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !ALLOWED_REVIEW_PAYLOAD_KEY_SET.has(key))) {
    return { ok: false, error: "リクエスト項目が正しくありません。" };
  }
  if (typeof raw.shopSlug !== "string" || typeof raw.nickname !== "string"
    || typeof raw.usedPeriod !== "string" || typeof raw.reviewBody !== "string"
    || (raw.website !== undefined && typeof raw.website !== "string")
    || (raw.revisitIntent !== undefined && typeof raw.revisitIntent !== "string")
    || (raw.campaignToken !== undefined && typeof raw.campaignToken !== "string")
    || (raw.ratingPrice !== undefined && typeof raw.ratingPrice !== "number")
    || (raw.ratingService !== undefined && typeof raw.ratingService !== "number")
    || (raw.ratingCleanliness !== undefined && typeof raw.ratingCleanliness !== "number")) {
    return { ok: false, error: "リクエスト形式が正しくありません。" };
  }

  const website = typeof raw.website === "string" ? raw.website.trim() : "";
  if (website) {
    return { ok: false, error: "送信に失敗しました。" };
  }

  const shopSlug = typeof raw.shopSlug === "string" ? stripHtml(raw.shopSlug.trim()) : "";
  const nickname = typeof raw.nickname === "string" ? stripHtml(raw.nickname.trim()) : "";
  const usedPeriod = typeof raw.usedPeriod === "string" ? raw.usedPeriod.trim() : "";
  const reviewBody = typeof raw.reviewBody === "string" ? stripHtml(raw.reviewBody.trim()) : "";
  const revisitIntent =
    typeof raw.revisitIntent === "string" ? stripHtml(raw.revisitIntent.trim()) : "";
  const campaignToken = typeof raw.campaignToken === "string"
    ? raw.campaignToken.trim().toLowerCase()
    : "";

  if (!shopSlug) {
    return { ok: false, error: "店舗が指定されていません。" };
  }
  if (shopSlug.length > LIMITS.shopSlug) {
    return { ok: false, error: "店舗指定が正しくありません。" };
  }

  if (!nickname) {
    return { ok: false, error: "ニックネームを入力してください。" };
  }
  if (nickname.length > LIMITS.nickname) {
    return { ok: false, error: `ニックネームは${LIMITS.nickname}文字以内で入力してください。` };
  }

  if (!USED_PERIODS.includes(usedPeriod as UsedPeriod)) {
    return { ok: false, error: "利用時期を選択してください。" };
  }

  const ratingTotal = parseRequiredRating(raw.ratingTotal);
  if (ratingTotal === null) {
    return { ok: false, error: "総合評価を1〜5の範囲で選択してください。" };
  }

  const optionalRatings = [
    parseOptionalRating(raw.ratingPrice),
    parseOptionalRating(raw.ratingService),
    parseOptionalRating(raw.ratingCleanliness)
  ];
  if (
    (raw.ratingPrice !== undefined && optionalRatings[0] === undefined) ||
    (raw.ratingService !== undefined && optionalRatings[1] === undefined) ||
    (raw.ratingCleanliness !== undefined &&
      optionalRatings[2] === undefined)
  ) {
    return { ok: false, error: "任意評価は1〜5の範囲で入力してください。" };
  }

  if (!reviewBody) {
    return { ok: false, error: "口コミ本文を入力してください。" };
  }
  if (reviewBody.length < LIMITS.reviewBodyMin) {
    return {
      ok: false,
      error: `口コミ本文は${LIMITS.reviewBodyMin}文字以上で入力してください。`
    };
  }
  if (reviewBody.length > LIMITS.reviewBodyMax) {
    return {
      ok: false,
      error: `口コミ本文は${LIMITS.reviewBodyMax}文字以内で入力してください。`
    };
  }

  if (revisitIntent.length > LIMITS.revisitIntent) {
    return { ok: false, error: `再訪意向は${LIMITS.revisitIntent}文字以内で入力してください。` };
  }

  if (raw.campaignToken !== undefined && !UUID_RE.test(campaignToken)) {
    return { ok: false, error: "キャンペーン情報が正しくありません。" };
  }

  return {
    ok: true,
    data: {
      shopSlug,
      nickname,
      usedPeriod: usedPeriod as UsedPeriod,
      ratingTotal,
      ratingPrice: optionalRatings[0],
      ratingService: optionalRatings[1],
      ratingCleanliness: optionalRatings[2],
      revisitIntent: revisitIntent || undefined,
      reviewBody,
      campaignToken: campaignToken || undefined,
    }
  };
}
