export const CONTACT_TYPES = [
  "掲載希望",
  "情報修正",
  "一般問い合わせ",
  "その他"
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export type ContactPayload = {
  type: string;
  name: string;
  email: string;
  shopName?: string;
  targetUrl?: string;
  message: string;
  consent: boolean;
  website?: string;
  sourceUrl?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
  name: 80,
  email: 254,
  shopName: 120,
  targetUrl: 500,
  message: 5000,
  website: 200,
  sourceUrl: 2048
} as const;

const HTTP_URL_RE = /^https?:\/\/.+/i;

function normalizeSourceUrl(value: string): string {
  if (value.length <= LIMITS.sourceUrl) {
    return value;
  }
  return value.slice(0, LIMITS.sourceUrl);
}

export type ValidationResult =
  | { ok: true; data: ContactPayload }
  | { ok: false; error: string };

export function validateContactPayload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "リクエスト形式が正しくありません。" };
  }

  const raw = body as Record<string, unknown>;

  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const shopName = typeof raw.shopName === "string" ? raw.shopName.trim() : "";
  const targetUrl = typeof raw.targetUrl === "string" ? raw.targetUrl.trim() : "";
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  const consent = raw.consent === true;
  const website = typeof raw.website === "string" ? raw.website.trim() : "";
  const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";

  if (website) {
    return { ok: false, error: "送信に失敗しました。" };
  }

  if (!CONTACT_TYPES.includes(type as ContactType)) {
    return { ok: false, error: "お問い合わせ種別を選択してください。" };
  }

  if (!name) {
    return { ok: false, error: "お名前を入力してください。" };
  }
  if (name.length > LIMITS.name) {
    return { ok: false, error: `お名前は${LIMITS.name}文字以内で入力してください。` };
  }

  if (!email) {
    return { ok: false, error: "メールアドレスを入力してください。" };
  }
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "メールアドレスの形式が正しくありません。" };
  }

  if (shopName.length > LIMITS.shopName) {
    return { ok: false, error: `店舗名は${LIMITS.shopName}文字以内で入力してください。` };
  }

  if (targetUrl.length > LIMITS.targetUrl) {
    return { ok: false, error: `対象URLは${LIMITS.targetUrl}文字以内で入力してください。` };
  }
  if (targetUrl && !HTTP_URL_RE.test(targetUrl)) {
    return { ok: false, error: "対象URLは http:// または https:// で始まるURLを入力してください。" };
  }

  if (!message) {
    return { ok: false, error: "お問い合わせ内容を入力してください。" };
  }
  if (message.length > LIMITS.message) {
    return { ok: false, error: `お問い合わせ内容は${LIMITS.message}文字以内で入力してください。` };
  }

  if (!consent) {
    return { ok: false, error: "個人情報の取り扱いに同意してください。" };
  }

  return {
    ok: true,
    data: {
      type,
      name,
      email,
      shopName: shopName || undefined,
      targetUrl: targetUrl || undefined,
      message,
      consent,
      sourceUrl: sourceUrl ? normalizeSourceUrl(sourceUrl) : undefined
    }
  };
}

export function buildContactEmailText(data: ContactPayload, submittedAt: Date): string {
  const lines = [
    "【Escomi お問い合わせフォーム】",
    "",
    `お問い合わせ種別: ${data.type}`,
    `お名前: ${data.name}`,
    `メールアドレス: ${data.email}`,
    `店舗名: ${data.shopName || "（未入力）"}`,
    `対象URL: ${data.targetUrl || "（未入力）"}`,
    "",
    "お問い合わせ内容:",
    data.message,
    "",
    `送信元URL: ${data.sourceUrl || "（不明）"}`,
    `送信日時: ${submittedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
  ];
  return lines.join("\n");
}
