import "server-only";

import { createHash } from "node:crypto";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type {
  ShopAreaRankingSnapshot,
  ShopFactField,
  ShopFactProvenance
} from "@/lib/wp/types";

export type ShopInformationCoverage = {
  verifiedCount: number;
  totalCount: 6;
  latestReviewedAt: string | null;
  items: Array<{
    key: "price" | "hours" | "access" | "booking" | "official" | "image";
    label: string;
    verified: boolean;
  }>;
};

export type ShopRankingSnapshot = ShopAreaRankingSnapshot;

const COVERAGE_ITEMS = [
  { key: "price", label: "料金" },
  { key: "hours", label: "営業時間" },
  { key: "access", label: "駅・アクセス" },
  { key: "booking", label: "予約先" },
  { key: "official", label: "公式サイト" },
  { key: "image", label: "店舗画像" }
] as const satisfies ReadonlyArray<{ key: ShopFactField; label: string }>;

const SOURCE_TYPES = new Set(["official-site", "shop-provided", "admin-verified"]);
const REVIEW_STATUSES = new Set(["reviewed", "pending", "rejected"]);

function isShopFactField(value: unknown): value is ShopFactField {
  return typeof value === "string" && COVERAGE_ITEMS.some((item) => item.key === value);
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[\t\f\v ]+/g, " "))
    .join("\n")
    .trim();
}

function normalizeHttpUrl(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeActionHref(value: unknown): string {
  const raw = normalizeText(value);
  if (/^tel:[0-9]+$/.test(raw)) return raw;
  return normalizeHttpUrl(raw);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const dateOnly = value.slice(0, 10);
  return new Date(`${dateOnly}T00:00:00.000Z`).toISOString().slice(0, 10) === dateOnly;
}

function priceDuration(label: unknown, key: unknown): number | null {
  for (const value of [label, key]) {
    const match = normalizeText(value).match(/(?:^|_)(\d{2,3})(?:分|$)/);
    if (!match) continue;
    const duration = Number(match[1]);
    if (Number.isInteger(duration) && duration > 0) return duration;
  }
  return null;
}

function currentInfoValue(model: ShopDetailViewModel, key: string): string {
  return normalizeText(model.infoRows.find((row) => row.key === key)?.value);
}

export function canonicalizeShopFactValue(
  field: ShopFactField,
  model: ShopDetailViewModel
): string {
  if (field === "price") {
    const courses = model.prices
      .map((course) => ({
        durationMinutes: priceDuration(course.label, course.key),
        priceYen:
          course.price.status === "confirmed" && Number.isInteger(course.price.amount)
            ? course.price.amount
            : null
      }))
      .filter(
        (course): course is { durationMinutes: number; priceYen: number } =>
          course.durationMinutes !== null && course.priceYen !== null && course.priceYen > 0
      )
      .sort(
        (first, second) =>
          first.durationMinutes - second.durationMinutes || first.priceYen - second.priceYen
      );
    return JSON.stringify(courses);
  }

  if (field === "hours") return JSON.stringify(currentInfoValue(model, "hours"));

  if (field === "access") {
    return JSON.stringify(
      [currentInfoValue(model, "station"), currentInfoValue(model, "address")].filter(Boolean)
    );
  }

  if (field === "booking") {
    const actions = model.actions
      .filter((action) => action.kind !== "official")
      .map((action) => ({ kind: action.kind, href: normalizeActionHref(action.href) }))
      .filter((action) => action.href)
      .sort(
        (first, second) =>
          first.kind.localeCompare(second.kind) || first.href.localeCompare(second.href)
      );
    return JSON.stringify(actions);
  }

  if (field === "official") {
    const official = model.actions.find((action) => action.kind === "official");
    return JSON.stringify(normalizeHttpUrl(official?.href));
  }

  return JSON.stringify(
    model.images
      .filter((image) => !image.isFallback)
      .map((image) => normalizeHttpUrl(image.url) || normalizeText(image.url))
      .filter(Boolean)
  );
}

export function hashShopFactValue(field: ShopFactField, model: ShopDetailViewModel): string {
  return createHash("sha256").update(canonicalizeShopFactValue(field, model), "utf8").digest("hex");
}

function normalizeProvenance(value: unknown): ShopFactProvenance[] {
  if (!Array.isArray(value)) return [];
  const latestByField = new Map<ShopFactField, ShopFactProvenance>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const field = record.field;
    if (!isShopFactField(field)) continue;
    const sourceUrl = normalizeHttpUrl(record.sourceUrl);
    if (
      !sourceUrl ||
      !SOURCE_TYPES.has(String(record.sourceType)) ||
      !validDate(record.observedAt) ||
      !validDate(record.reviewedAt) ||
      !REVIEW_STATUSES.has(String(record.reviewStatus)) ||
      typeof record.publishedValueHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.publishedValueHash)
    ) {
      continue;
    }
    const normalized = {
      field,
      sourceUrl,
      sourceType: record.sourceType,
      observedAt: record.observedAt,
      reviewedAt: record.reviewedAt,
      reviewStatus: record.reviewStatus,
      publishedValueHash: record.publishedValueHash
    } as ShopFactProvenance;
    const current = latestByField.get(field);
    if (!current || Date.parse(normalized.reviewedAt) > Date.parse(current.reviewedAt)) {
      latestByField.set(field, normalized);
    }
  }
  return [...latestByField.values()];
}

export function buildShopInformationCoverage(
  model: ShopDetailViewModel,
  value: unknown
): ShopInformationCoverage | null {
  const provenance = normalizeProvenance(value);
  if (provenance.length === 0) return null;
  const byField = new Map(provenance.map((record) => [record.field, record]));
  const items = COVERAGE_ITEMS.map(({ key, label }) => {
    const record = byField.get(key);
    return {
      key,
      label,
      verified: Boolean(
        record &&
          record.reviewStatus === "reviewed" &&
          validDate(record.reviewedAt) &&
          record.publishedValueHash === hashShopFactValue(key, model)
      )
    };
  });
  const verifiedDates = items
    .filter((item) => item.verified)
    .map((item) => byField.get(item.key)?.reviewedAt)
    .filter((date): date is string => Boolean(date))
    .sort((first, second) => Date.parse(second) - Date.parse(first));
  return {
    verifiedCount: items.filter((item) => item.verified).length,
    totalCount: 6,
    latestReviewedAt: verifiedDates[0] ?? null,
    items
  };
}

export function normalizeShopRankingSnapshot(
  value: unknown,
  currentAreaSlug: string | null | undefined
): ShopRankingSnapshot | null {
  const expectedAreaSlug = normalizeText(currentAreaSlug);
  if (!Array.isArray(value) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(expectedAreaSlug)) return null;
  const snapshots = value.flatMap((item): ShopRankingSnapshot[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const areaSlug = normalizeText(record.areaSlug);
    const basis = normalizeText(record.basis);
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(areaSlug) ||
      !Number.isInteger(record.rank) ||
      Number(record.rank) <= 0 ||
      !Number.isInteger(record.totalEligibleShops) ||
      Number(record.totalEligibleShops) < Number(record.rank) ||
      !basis ||
      !validDate(record.observedAt) ||
      typeof record.isPr !== "boolean"
    ) {
      return [];
    }
    return [{
      areaSlug,
      rank: Number(record.rank),
      totalEligibleShops: Number(record.totalEligibleShops),
      basis,
      observedAt: record.observedAt,
      isPr: record.isPr
    }];
  });
  return snapshots.filter((snapshot) => snapshot.areaSlug === expectedAreaSlug).sort(
    (first, second) => Date.parse(second.observedAt) - Date.parse(first.observedAt)
  )[0] ?? null;
}
