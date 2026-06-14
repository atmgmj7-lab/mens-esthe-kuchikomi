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
  sourceUrl?: string;
};

const LIMITS = {
  nickname: 30,
  reviewBodyMin: 30,
  reviewBodyMax: 1000,
  revisitIntent: 200,
  website: 200,
  sourceUrl: 2048,
  shopSlug: 200
} as const;

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
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 5) {
    return undefined;
  }
  return num;
}

function parseRequiredRating(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 5) {
    return null;
  }
  return num;
}

export function validateReviewPayload(body: unknown): ReviewValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "リクエスト形式が正しくありません。" };
  }

  const raw = body as Record<string, unknown>;

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
  const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";

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
    (raw.ratingPrice !== undefined && raw.ratingPrice !== "" && optionalRatings[0] === undefined) ||
    (raw.ratingService !== undefined && raw.ratingService !== "" && optionalRatings[1] === undefined) ||
    (raw.ratingCleanliness !== undefined &&
      raw.ratingCleanliness !== "" &&
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
      sourceUrl: sourceUrl.slice(0, LIMITS.sourceUrl) || undefined
    }
  };
}
