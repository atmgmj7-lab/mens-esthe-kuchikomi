const PRICE_FIELDS = [
  "shop_price_60min",
  "price_60",
  "price_50",
  "price_70",
  "price_80",
  "price_90",
  "price_120",
  "price_150",
  "basic_price"
];
const ADDRESS_FIELDS = ["shop_address", "address", "shop_access", "access"];
const SOURCE_URL_FIELDS = ["source_url", "information_source_url", "verified_source_url"];
const VERIFIED_DATE_FIELDS = ["verified_at", "last_verified_at", "information_verified_at"];
const AI_SUMMARY_FIELDS = ["shop_ai_summary", "ai_summary"];

export function normalizeWordPressApiBase(value) {
  const base = text(value).replace(/\/+$/, "");
  if (/\/wp-json\/wp\/v2$/i.test(base)) return base;
  if (/\/wp-json$/i.test(base)) return `${base}/wp/v2`;
  return `${base}/wp-json/wp/v2`;
}

function text(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function rendered(value) {
  if (typeof value === "object" && value !== null && "rendered" in value) {
    return text(value.rendered);
  }
  return text(value);
}

function plainText(value) {
  return rendered(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (text(value)) return value;
  }
  return null;
}

function metric(present, total) {
  return {
    present,
    missing: Math.max(0, total - present),
    percentage: total === 0 ? 0 : Number(((present / total) * 100).toFixed(1))
  };
}

function hasFeaturedImage(shop) {
  if (Number(shop?.featured_media) > 0) return true;
  const media = shop?._embedded?.["wp:featuredmedia"];
  return Array.isArray(media) && media.some((item) => text(item?.source_url));
}

function parsePriceValue(value) {
  if (typeof value === "number") {
    if (value > 0 && Number.isFinite(value)) return "usable";
    if (value === 0) return "zero";
    return "unknown";
  }

  const normalized = text(value)
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ",")
    .replace(/\s+/g, "");
  if (!normalized) return "unknown";
  if (/^(?:0|0円|無料|free)$/i.test(normalized)) return "zero";
  const match = normalized.match(/(?:^|[^0-9])((?:\d{1,3}(?:,\d{3})+|\d{4,7}))(?:円|yen)?/i);
  if (!match) return "unknown";
  const amount = Number(match[1].replace(/,/g, ""));
  if (amount > 0 && Number.isFinite(amount)) return "usable";
  return amount === 0 ? "zero" : "unknown";
}

function shopPriceState(shop) {
  const acf = shop?.acf || {};
  let zeroLike = false;
  for (const key of PRICE_FIELDS) {
    const state = parsePriceValue(acf[key]);
    if (state === "usable") return { usable: true, zeroLike };
    if (state === "zero") zeroLike = true;
  }
  return { usable: false, zeroLike };
}

function shopAreaIds(shop) {
  if (Array.isArray(shop?.area)) {
    return shop.area.filter((id) => Number.isFinite(Number(id))).map(Number);
  }

  const termGroups = shop?._embedded?.["wp:term"];
  if (!Array.isArray(termGroups)) return [];
  return termGroups
    .flat()
    .filter((term) => term?.taxonomy === "area")
    .map((term) => Number(term.id))
    .filter(Number.isFinite);
}

function looksLikeStreetAddress(value) {
  const address = text(value);
  if (!address) return false;
  const hasAdministrativeArea = /(?:都|道|府|県).*(?:市|区|町|村)/.test(address);
  const hasStreetNumber = /\d+(?:丁目|番地|番|号|-\d)/.test(address);
  const accessOnly = /(?:駅|出口|徒歩|アクセス|分)/.test(address) && !hasAdministrativeArea;
  return !accessOnly && (hasAdministrativeArea || hasStreetNumber);
}

function shopOfficialUrl(shop) {
  return text(shop?.official_url || shop?.acf?.official_url);
}

function dedicatedSourceUrl(shop) {
  return text(firstValue(shop?.acf || {}, SOURCE_URL_FIELDS));
}

function verifiedDate(shop) {
  return text(firstValue(shop?.acf || {}, VERIFIED_DATE_FIELDS));
}

function aiSummary(shop) {
  return text(firstValue(shop?.acf || {}, AI_SUMMARY_FIELDS));
}

export function auditWordPressMigrationSource({
  shops = [],
  areas = [],
  reviewsEndpointStatus = "unchecked"
} = {}) {
  const shopList = Array.isArray(shops) ? shops : [];
  const areaList = Array.isArray(areas) ? areas : [];
  const prices = shopList.map(shopPriceState);
  const addressValues = shopList.map((shop) => firstValue(shop?.acf || {}, ADDRESS_FIELDS));

  const count = (predicate) => shopList.filter(predicate).length;
  const shopTotal = shopList.length;
  const areaTotal = areaList.length;

  return {
    totals: { shops: shopTotal, areas: areaTotal },
    completeness: {
      titles: metric(count((shop) => plainText(shop?.title)), shopTotal),
      content: metric(count((shop) => plainText(shop?.content)), shopTotal),
      excerpts: metric(count((shop) => plainText(shop?.excerpt)), shopTotal),
      featuredImages: metric(count(hasFeaturedImage), shopTotal),
      officialUrls: metric(count((shop) => shopOfficialUrl(shop)), shopTotal),
      usablePrices: metric(prices.filter((price) => price.usable).length, shopTotal),
      aiSummaries: metric(count((shop) => aiSummary(shop)), shopTotal),
      streetAddresses: metric(addressValues.filter(looksLikeStreetAddress).length, shopTotal),
      sourceUrls: metric(count((shop) => dedicatedSourceUrl(shop)), shopTotal),
      verifiedDates: metric(count((shop) => verifiedDate(shop)), shopTotal)
    },
    areaDescriptions: metric(
      areaList.filter((area) => plainText(area?.description) || plainText(area?.acf?.description)).length,
      areaTotal
    ),
    risks: {
      zeroLikePrimaryPrices: prices.filter((price) => price.zeroLike && !price.usable).length,
      shopsWithoutArea: shopList.filter((shop) => shopAreaIds(shop).length === 0).length,
      shopsWithMultipleAreas: shopList.filter((shop) => shopAreaIds(shop).length > 1).length,
      addressFieldsNeedingReview: addressValues.filter(
        (value) => text(value) && !looksLikeStreetAddress(value)
      ).length,
      reviewsEndpointStatus
    },
    migrationPolicy: {
      zeroPrice: "store-as-null-until-verified",
      unknownAddress: "keep-in-import-record-until-reviewed",
      aiSummary: "import-as-ai-generated-content-only",
      unknownReviews: "do-not-import-as-user-review",
      missingSource: "publish-only-after-source-and-verified-at"
    }
  };
}
