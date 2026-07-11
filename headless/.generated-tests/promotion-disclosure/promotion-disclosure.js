"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROMOTION_SECTION_NOTE = exports.PROMOTION_SECTION_TITLE = exports.PROMOTION_DISCLOSURE_LABEL = void 0;
exports.resolvePromotionDisclosure = resolvePromotionDisclosure;
exports.outboundRelForPromotion = outboundRelForPromotion;
exports.PROMOTION_DISCLOSURE_LABEL = "PR";
exports.PROMOTION_SECTION_TITLE = "PR・広告掲載枠";
exports.PROMOTION_SECTION_NOTE = "PR・広告掲載枠は自然順位とは分けて表示しています。掲載順は料金・契約条件・編集確認状況などを含む可能性があります。";
const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on", "pr", "paid", "sponsored", "sponsor", "advertising", "ad"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off", "none", "null", "undefined", ""]);
const PAID_BOOLEAN_FIELDS = ["is_pr", "sponsored", "is_sponsored", "paid_placement", "is_paid_placement", "is_ad", "is_advertisement"];
const PAID_REFERENCE_FIELDS = ["ad_contract_id", "ad_campaign_id", "campaign_reference", "sponsor_name", "sponsor_id"];
const AFFILIATE_FIELDS = ["affiliate", "is_affiliate", "affiliate_network", "affiliate_url"];
const PROMOTION_TYPE_FIELDS = ["promotion_type", "ad_type", "listing_type", "placement_type"];
const FEATURE_FIELDS = ["featured", "is_featured", "recommended", "is_recommended", "pickup", "is_pickup", "ranking_featured"];
const START_DATE_FIELDS = ["promotion_start_at", "promotion_starts_at", "ad_start_at", "ad_starts_at", "campaign_start_at"];
const END_DATE_FIELDS = ["promotion_end_at", "promotion_ends_at", "ad_end_at", "ad_ends_at", "campaign_end_at"];
function valueToString(value) {
    if (value == null)
        return null;
    if (typeof value === "string")
        return value.trim();
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    return null;
}
function normalizedString(value) {
    return valueToString(value)?.toLowerCase() ?? "";
}
function isTruthyValue(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value !== 0;
    const normalized = normalizedString(value);
    if (TRUE_VALUES.has(normalized))
        return true;
    if (FALSE_VALUES.has(normalized))
        return false;
    return false;
}
function hasNonEmptyValue(value) {
    const asString = valueToString(value);
    return Boolean(asString && !FALSE_VALUES.has(asString.toLowerCase()));
}
function findTruthyField(acf, fields) {
    if (!acf)
        return null;
    for (const field of fields) {
        if (isTruthyValue(acf[field]))
            return { field, value: acf[field] };
    }
    return null;
}
function findNonEmptyField(acf, fields) {
    if (!acf)
        return null;
    for (const field of fields) {
        if (hasNonEmptyValue(acf[field]))
            return { field, value: acf[field] };
    }
    return null;
}
function parseDate(value) {
    const asString = valueToString(value);
    if (!asString)
        return null;
    const parsed = new Date(asString);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function findDate(acf, fields) {
    if (!acf)
        return null;
    for (const field of fields) {
        const date = parseDate(acf[field]);
        if (date)
            return { field, value: acf[field], date };
    }
    return null;
}
function paidDisclosure(type, matched, reason) {
    return {
        promotionType: type,
        isPaid: true,
        requiresDisclosure: true,
        isEligibleForNaturalRanking: false,
        canReceiveNaturalRankNumber: false,
        disclosureLabel: type === "affiliate" ? "広告" : "PR",
        sourceField: matched.field,
        sourceValue: valueToString(matched.value),
        outboundRel: "sponsored nofollow noreferrer",
        reason
    };
}
function manualDisclosure(type, matched, reason) {
    return {
        promotionType: type,
        isPaid: null,
        requiresDisclosure: false,
        isEligibleForNaturalRanking: false,
        canReceiveNaturalRankNumber: false,
        disclosureLabel: type === "unknown" ? "要確認" : "注目",
        sourceField: matched.field,
        sourceValue: valueToString(matched.value),
        outboundRel: "noreferrer",
        reason
    };
}
function resolvePromotionDisclosure(acf, now = new Date()) {
    const startedAt = findDate(acf, START_DATE_FIELDS);
    const endedAt = findDate(acf, END_DATE_FIELDS);
    const beforeStart = Boolean(startedAt && startedAt.date.getTime() > now.getTime());
    const afterEnd = Boolean(endedAt && endedAt.date.getTime() < now.getTime());
    const inactiveDate = beforeStart ? startedAt : afterEnd ? endedAt : null;
    const paidFlag = findTruthyField(acf, PAID_BOOLEAN_FIELDS);
    const paidReference = findNonEmptyField(acf, PAID_REFERENCE_FIELDS);
    const affiliateFlag = findTruthyField(acf, AFFILIATE_FIELDS) || findNonEmptyField(acf, AFFILIATE_FIELDS);
    const promotionType = findNonEmptyField(acf, PROMOTION_TYPE_FIELDS);
    const featureFlag = findTruthyField(acf, FEATURE_FIELDS);
    if (inactiveDate && (paidFlag || paidReference || affiliateFlag || promotionType)) {
        return manualDisclosure("unknown", { field: inactiveDate.field, value: inactiveDate.value }, "promotion-date-outside-active-window");
    }
    if (promotionType) {
        const value = normalizedString(promotionType.value);
        if (["affiliate", "affiliate-ad", "affiliate_link"].includes(value)) {
            return paidDisclosure("affiliate", promotionType, "explicit-affiliate-promotion-type");
        }
        if (["sponsored", "sponsor", "sponsor-slot"].includes(value)) {
            return paidDisclosure("sponsored", promotionType, "explicit-sponsored-promotion-type");
        }
        if (["pr", "paid", "paid-placement", "ad", "advertising", "advertisement", "advertorial"].includes(value)) {
            return paidDisclosure("paid-placement", promotionType, "explicit-paid-promotion-type");
        }
        if (["editorial", "editorial-featured"].includes(value)) {
            return manualDisclosure("editorial-featured", promotionType, "explicit-editorial-featured-type");
        }
        if (["featured", "manual-featured", "recommended", "pickup"].includes(value)) {
            return manualDisclosure("manual-featured", promotionType, "explicit-manual-featured-type");
        }
        return manualDisclosure("unknown", promotionType, "unknown-promotion-type");
    }
    if (affiliateFlag)
        return paidDisclosure("affiliate", affiliateFlag, "explicit-affiliate-field");
    if (paidFlag) {
        const field = paidFlag.field.toLowerCase();
        const type = field.includes("sponsor") ? "sponsored" : "paid-placement";
        return paidDisclosure(type, paidFlag, "explicit-paid-field");
    }
    if (paidReference)
        return paidDisclosure("paid-placement", paidReference, "explicit-paid-reference-field");
    if (featureFlag)
        return manualDisclosure("manual-featured", featureFlag, "featured-field-is-not-treated-as-pr");
    return {
        promotionType: "organic",
        isPaid: null,
        requiresDisclosure: false,
        isEligibleForNaturalRanking: true,
        canReceiveNaturalRankNumber: true,
        disclosureLabel: "",
        sourceField: null,
        sourceValue: null,
        outboundRel: "noreferrer",
        reason: "no-explicit-promotion-field"
    };
}
function outboundRelForPromotion(disclosure, baseRel = "noreferrer") {
    const baseTokens = baseRel.split(/\s+/).filter(Boolean);
    const tokens = disclosure?.requiresDisclosure ? ["sponsored", "nofollow", ...baseTokens] : baseTokens;
    return Array.from(new Set(tokens)).join(" ");
}
