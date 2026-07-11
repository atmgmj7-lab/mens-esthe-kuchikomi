export type PriceStatus = "confirmed" | "free" | "unknown" | "invalid";

export type PriceContext =
  | "primary-course"
  | "course"
  | "nomination-fee"
  | "admission-fee"
  | "transportation-fee"
  | "option-fee"
  | "campaign"
  | "unknown";

export type NormalizedPrice = {
  status: PriceStatus;
  amount: number | null;
  displayText: string | null;
  sourceValue: unknown;
  reason?: string;
  fieldName?: string;
};

export type PriceNormalizeOptions = {
  fieldName?: string;
};

export const PRIMARY_PRICE_FIELD_KEYS = [
  "shop_price_60min",
  "price_60",
  "price_50",
  "price_70",
  "price_80",
  "price_90",
  "price_120",
  "price_150",
  "basic_price"
] as const;

export const COURSE_PRICE_FIELDS = [
  { key: "price_50", label: "50分" },
  { key: "price_60", label: "60分" },
  { key: "price_70", label: "70分" },
  { key: "price_80", label: "80分" },
  { key: "price_90", label: "90分" },
  { key: "price_120", label: "120分" },
  { key: "price_150", label: "150分" }
] as const;

const FREE_ALLOWED_CONTEXTS = new Set<PriceContext>([
  "nomination-fee",
  "admission-fee",
  "transportation-fee",
  "option-fee",
  "campaign"
]);

const UNKNOWN_TEXT_PATTERN = /^(?:-|ー|—|null|undefined|nan|未確認|不明|要確認|要問合せ|要問い合わせ|お問い合わせ|問合せ|応相談|未掲載|非公開)$/i;
const FREE_TEXT_PATTERN = /^(?:無料|free)$/i;
const ZERO_YEN_PATTERN = /^0\s*(?:円|yen)?$/i;
const NEGATIVE_PATTERN = /^-\s*\d/;

function basePrice(
  status: PriceStatus,
  amount: number | null,
  sourceValue: unknown,
  reason: string,
  fieldName?: string
): NormalizedPrice {
  return {
    status,
    amount,
    displayText:
      status === "confirmed" && amount != null
        ? `${amount.toLocaleString("ja-JP")}円`
        : status === "free"
          ? "無料"
          : null,
    sourceValue,
    reason,
    fieldName
  };
}

function normalizeText(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[，]/g, ",")
    .replace(/[．]/g, ".")
    .trim();
}

function canTreatFreeAsFree(context: PriceContext): boolean {
  return FREE_ALLOWED_CONTEXTS.has(context);
}

function normalizeZero(value: unknown, context: PriceContext, fieldName?: string): NormalizedPrice {
  if (canTreatFreeAsFree(context) && typeof value === "string" && /(?:無料|free|0\s*円)/i.test(value)) {
    return basePrice("free", 0, value, "explicit-free", fieldName);
  }

  return basePrice("unknown", null, value, "zero-is-not-confirmed-primary-price", fieldName);
}

function parsePriceAmountFromText(value: string): number | null {
  const compact = value.replace(/\s+/g, "");
  const priceLike = compact.match(/(?:^|[^0-9])((?:\d{1,3}(?:,\d{3})+|\d{4,7}|\d{1,7})(?:\.\d+)?)(?:円|yen)?/i);
  if (!priceLike) {
    return null;
  }

  const numeric = Number(priceLike[1].replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

export function normalizePrice(
  value: unknown,
  context: PriceContext = "unknown",
  options: PriceNormalizeOptions = {}
): NormalizedPrice {
  const fieldName = options.fieldName;

  if (Array.isArray(value)) {
    const minimum = getMinimumConfirmedPrice(value, context, options);
    return minimum.status === "confirmed"
      ? { ...minimum, sourceValue: value }
      : basePrice("unknown", null, value, "array-has-no-confirmed-price", fieldName);
  }

  if (value === null || value === undefined) {
    return basePrice("unknown", null, value, "empty", fieldName);
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return basePrice("invalid", null, value, "nan", fieldName);
    }
    if (!Number.isFinite(value)) {
      return basePrice("invalid", null, value, "not-finite", fieldName);
    }
    if (value < 0) {
      return basePrice("invalid", null, value, "negative", fieldName);
    }
    if (value === 0) {
      return normalizeZero(value, context, fieldName);
    }
    if (!Number.isInteger(value)) {
      return basePrice("invalid", null, value, "fractional-yen", fieldName);
    }
    return basePrice("confirmed", value, value, "positive-number", fieldName);
  }

  if (typeof value !== "string") {
    return basePrice("invalid", null, value, "unsupported-type", fieldName);
  }

  const raw = normalizeText(value);
  if (!raw) {
    return basePrice("unknown", null, value, "empty", fieldName);
  }

  if (UNKNOWN_TEXT_PATTERN.test(raw)) {
    return basePrice(raw.toLowerCase() === "nan" ? "invalid" : "unknown", null, value, "unknown-text", fieldName);
  }

  if (FREE_TEXT_PATTERN.test(raw)) {
    if (canTreatFreeAsFree(context)) {
      return basePrice("free", 0, value, "explicit-free", fieldName);
    }
    return basePrice("unknown", null, value, "free-is-not-confirmed-primary-price", fieldName);
  }

  if (NEGATIVE_PATTERN.test(raw)) {
    return basePrice("invalid", null, value, "negative", fieldName);
  }

  if (ZERO_YEN_PATTERN.test(raw)) {
    return normalizeZero(raw, context, fieldName);
  }

  const amount = parsePriceAmountFromText(raw);
  if (amount === null) {
    return basePrice("invalid", null, value, "not-a-price", fieldName);
  }
  if (amount < 0) {
    return basePrice("invalid", null, value, "negative", fieldName);
  }
  if (amount === 0) {
    return normalizeZero(raw, context, fieldName);
  }
  if (!Number.isInteger(amount)) {
    return basePrice("invalid", null, value, "fractional-yen", fieldName);
  }

  return basePrice("confirmed", amount, value, "positive-price-text", fieldName);
}

export function getMinimumConfirmedPrice(
  values: unknown[],
  context: PriceContext = "primary-course",
  options: PriceNormalizeOptions = {}
): NormalizedPrice {
  const confirmed = values
    .flat(Infinity)
    .map((value) => normalizePrice(value, context, options))
    .filter(
      (price): price is NormalizedPrice & { status: "confirmed"; amount: number } =>
        price.status === "confirmed" && price.amount != null && Number.isFinite(price.amount) && price.amount > 0
    );

  if (confirmed.length === 0) {
    return basePrice("unknown", null, values, "no-confirmed-price", options.fieldName);
  }

  return confirmed.reduce((min, price) => (price.amount < min.amount ? price : min));
}

export function formatPriceForDisplay(price: NormalizedPrice, suffix = ""): string | null {
  if (price.status === "confirmed" && price.amount != null && price.amount > 0) {
    return `${price.amount.toLocaleString("ja-JP")}円${suffix}`;
  }
  if (price.status === "free") {
    return "無料";
  }
  return null;
}

export function shouldOutputPriceSchema(price: NormalizedPrice): boolean {
  return price.status === "confirmed" && price.amount != null && Number.isFinite(price.amount) && price.amount > 0;
}

export function resolveShopPrimaryPrice(acf: Record<string, unknown>): NormalizedPrice {
  for (const key of PRIMARY_PRICE_FIELD_KEYS) {
    const price = normalizePrice(acf[key], "primary-course", { fieldName: key });
    if (price.status === "confirmed") {
      return price;
    }
  }

  return basePrice("unknown", null, null, "shop-has-no-confirmed-primary-price");
}

export function resolveShopCoursePrices(acf: Record<string, unknown>): Array<{
  key: (typeof COURSE_PRICE_FIELDS)[number]["key"];
  label: string;
  price: NormalizedPrice & { status: "confirmed"; amount: number };
}> {
  const rows: Array<{
    key: (typeof COURSE_PRICE_FIELDS)[number]["key"];
    label: string;
    price: NormalizedPrice & { status: "confirmed"; amount: number };
  }> = [];

  for (const field of COURSE_PRICE_FIELDS) {
    const price = normalizePrice(acf[field.key], "course", { fieldName: field.key });
    if (price.status === "confirmed" && price.amount != null && price.amount > 0) {
      rows.push({
        key: field.key,
        label: field.label,
        price: price as NormalizedPrice & { status: "confirmed"; amount: number }
      });
    }
  }

  return rows;
}
