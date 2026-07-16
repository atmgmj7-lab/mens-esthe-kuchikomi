const UNKNOWN_DISPLAY_VALUES = new Set([
  "-",
  "ー",
  "—",
  "null",
  "undefined",
  "未確認",
  "不明",
  "要確認",
  "未掲載",
  "非公開"
]);

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "•",
  cent: "¢",
  copy: "©",
  deg: "°",
  divide: "÷",
  emsp: " ",
  ensp: " ",
  euro: "€",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  plusmn: "±",
  pound: "£",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  shy: "",
  thinsp: " ",
  times: "×",
  trade: "™",
  yen: "¥"
};

function decodeHtmlEntity(entity: string, body: string): string {
  const lower = body.toLowerCase();
  if (lower.startsWith("#x")) {
    const codePoint = Number.parseInt(lower.slice(2), 16);
    return decodeCodePoint(codePoint);
  }
  if (lower.startsWith("#")) {
    const codePoint = Number.parseInt(lower.slice(1), 10);
    return decodeCodePoint(codePoint);
  }
  return NAMED_HTML_ENTITIES[lower] ?? entity;
}

function decodeCodePoint(codePoint: number): string {
  const isControl = codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff;
  const isNonCharacter =
    (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
    (codePoint & 0xffff) === 0xfffe ||
    (codePoint & 0xffff) === 0xffff;
  if (
    !Number.isInteger(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    isControl ||
    isSurrogate ||
    isNonCharacter
  ) {
    return "";
  }
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(
      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
      (entity, body: string) => decodeHtmlEntity(entity, body)
    );
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function normalizeShopFactText(value: unknown): string {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";
  if (!raw) return "";

  return decodeHtmlEntities(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeShopDisplayText(value: unknown): string {
  const normalized = normalizeShopFactText(value);
  if (!normalized || /^0(?:\.0+)?$/.test(normalized)) return "";
  return UNKNOWN_DISPLAY_VALUES.has(normalized.toLowerCase()) ? "" : normalized;
}

function addressCheckText(value: string): string {
  return value
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
    .replace(/[－−ー]/g, "-");
}

export function isConfirmedJapaneseStreetAddress(value: unknown): boolean {
  const normalized = normalizeShopDisplayText(value);
  if (!normalized) return false;

  const checkText = addressCheckText(normalized);
  const hasAccessOrBusinessTime =
    /駅|出口|徒歩|アクセス|周辺|付近|目印|受付|営業|時刻|予約|電話/.test(checkText) ||
    /\d{1,2}\s*[:：]\s*\d{2}/.test(checkText) ||
    /\d{1,2}\s*[-〜～~]\s*\d{1,2}\s*時/.test(checkText) ||
    /\d{1,2}\s*時(?:\d{1,2}\s*分)?/.test(checkText) ||
    /\b(?:am|pm)\s*\d{1,2}(?::\d{2})?\b/i.test(checkText) ||
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(checkText) ||
    /\b24\s*h(?:ours?)?\b/i.test(checkText);
  if (hasAccessOrBusinessTime) return false;

  const hasAdministrativeArea = /都|道|府|県|市|区|町|村/.test(checkText);
  const streetCheckText = checkText.replace(/〒?\s*\d{3}\s*-\s*\d{4}/g, "");
  const hasStreetBlock =
    /\d+(?:丁目|番地|番|号)/.test(streetCheckText) ||
    /\d+\s*-\s*\d+/.test(streetCheckText);
  return hasAdministrativeArea && hasStreetBlock;
}

export type NormalizedShopAddress = {
  text: string;
  kind: "street-address" | "access-guide";
};

export function normalizeShopAddress(value: unknown): NormalizedShopAddress | null {
  const text = normalizeShopDisplayText(value);
  if (!text) return null;
  return {
    text,
    kind: isConfirmedJapaneseStreetAddress(text) ? "street-address" : "access-guide"
  };
}
