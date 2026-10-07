import type { ShopView } from "@/lib/wp/types";

/**
 * This mirrors only the existing WordPress official-facts writer allowlist.
 * It deliberately has no transport: an approved server-side writer remains a
 * separate Production gate.
 */
export const OPERATOR_WRITER_FIELDS = [
  "official_url",
  "basic_price",
  "shop_hours",
  "shop_address",
  "shop_tel",
  "shop_line",
  "shop_booking",
  "shop_holiday",
  "price_90",
  "shop_booking_url",
] as const;

export type OperatorWriterField = (typeof OPERATOR_WRITER_FIELDS)[number];

export type OperatorShopFactSnapshot = Readonly<{
  wpShopId: number;
  slug: string;
  values: Readonly<Record<OperatorWriterField, string | null>>;
}>;

export type OperatorShopFactChange = Readonly<{
  field: OperatorWriterField;
  before: string | null;
  after: string;
}>;

export type OperatorShopFactDryRun =
  | Readonly<{ state: "noop"; changes: readonly []; message: string }>
  | Readonly<{ state: "ready"; changes: readonly OperatorShopFactChange[]; message: string }>
  | Readonly<{ state: "invalid"; changes: readonly []; message: string }>
  | Readonly<{ state: "conflict"; changes: readonly []; message: string }>;

const numberFields = new Set<OperatorWriterField>(["basic_price", "price_90"]);

export const OPERATOR_WRITER_FIELD_LABELS: Readonly<Record<OperatorWriterField, string>> = {
  official_url: "公式URL",
  basic_price: "基本料金",
  shop_hours: "営業時間",
  shop_address: "住所",
  shop_tel: "電話番号",
  shop_line: "LINE URL",
  shop_booking: "予約案内",
  shop_holiday: "定休日",
  price_90: "90分料金",
  shop_booking_url: "予約URL",
};

function readableValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalized(value: string): string {
  return value.trim();
}

function sameSnapshot(left: OperatorShopFactSnapshot, right: OperatorShopFactSnapshot): boolean {
  return left.wpShopId === right.wpShopId
    && left.slug === right.slug
    && OPERATOR_WRITER_FIELDS.every((field) => left.values[field] === right.values[field]);
}

/** Build a read-only edit baseline from the exact WP REST projection. */
export function createOperatorShopFactSnapshot(shop: ShopView): OperatorShopFactSnapshot {
  const values = Object.fromEntries(OPERATOR_WRITER_FIELDS.map((field) => [
    field,
    field === "official_url" ? readableValue(shop.acf[field]) ?? readableValue(shop.officialUrl) : readableValue(shop.acf[field]),
  ])) as Record<OperatorWriterField, string | null>;
  return { wpShopId: shop.id, slug: shop.slug, values };
}

/**
 * Produce a local-only dry run. `current` is injectable so fixtures can prove
 * a stale-page conflict; the browser uses its rendered snapshot for both sides
 * and the eventual WordPress writer remains authoritative for its own CAS.
 */
export function createOperatorShopFactDryRun(
  expected: OperatorShopFactSnapshot,
  submitted: Readonly<Record<OperatorWriterField, string>>,
  current: OperatorShopFactSnapshot = expected,
): OperatorShopFactDryRun {
  if (!sameSnapshot(expected, current)) {
    return { state: "conflict", changes: [], message: "店舗情報が読み込み時から変わっています。再読込して内容を確認してください。" };
  }
  const changes: OperatorShopFactChange[] = [];
  for (const field of OPERATOR_WRITER_FIELDS) {
    const before = expected.values[field];
    const after = normalized(submitted[field]);
    if ((before === null || before === "") && after === "") continue;
    if (after === "") {
      return { state: "invalid", changes: [], message: `${OPERATOR_WRITER_FIELD_LABELS[field]}を空欄で上書きすることはできません。削除・非公開化は別の承認済み手順で扱います。` };
    }
    if (numberFields.has(field) && !/^[1-9][0-9]{0,6}$/.test(after)) {
      return { state: "invalid", changes: [], message: `${OPERATOR_WRITER_FIELD_LABELS[field]}は1〜7桁の正の数で入力してください。` };
    }
    if (before !== after) changes.push({ field, before, after });
  }
  return changes.length === 0
    ? { state: "noop", changes: [], message: "変更はありません。WordPressへの書込みは行いません。" }
    : { state: "ready", changes, message: "変更候補を確認しました。これはdry-runであり、WordPress・Supabaseへの書込みは行いません。" };
}
