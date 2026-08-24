import "server-only";

import { normalizePublicShopSlug } from "../shop-slug";
import { buildShopDetailViewModel } from "../shop-detail-view-model";
import { buildShopInformationCoverage, hashShopFactValue } from "../shop-information-coverage";
import { wpFetchPaginated } from "../wp/client";
import { normalizeShop } from "../wp/normalize";
import { validateApprovedGlobalReviewPage } from "../wp/reviews";
import type { ShopFactField, WpShop } from "../wp/types";
import {
  analyticsFailure,
  analyticsSuccess,
  type AnalyticsFailureState,
  type AnalyticsSourceResult,
  type AnalyticsWarning,
} from "./result";

const MAX_PAGE = 100;
const MAX_PER_PAGE = 100;
const REVIEW_PER_PAGE = 20;
const REQUIRED_FACTS = ["price", "hours", "official", "access"] as const;
const FACT_SOURCE_TYPES = new Set(["official-site", "shop-provided", "admin-verified"]);

export type ContentArea = Readonly<{ id: number; slug: string; name: string; parentId: number; publishedShopCount: number }>;
export type ContentShop = Readonly<{
  id: number;
  slug: string;
  title: string;
  verified: Readonly<{ price: boolean; hours: boolean; officialUrl: boolean; access: boolean }>;
  latestVerifiedRequiredFactAt: string | null;
}>;
export type ContentShopPage = Readonly<{ shops: readonly ContentShop[]; total: number; totalPages: number; page: number }>;
export type ApprovedReviewIdentifier = Readonly<{ id: number; shopId: number; shopSlug: string; areaSlugs: readonly string[] }>;
export type ApprovedReviewSummary = Readonly<{ total: number; totalPages: number; page: number; reviews: readonly ApprovedReviewIdentifier[] }>;
export type ContentHealthArea = Readonly<{
  area: ContentArea;
  publishedShops: number;
  verifiedPriceCount: number;
  verifiedHoursCount: number;
  verifiedOfficialUrlCount: number;
  verifiedAccessCount: number;
  approvedReviewCount: number;
  staleConfirmedDateShopCount: number;
  missingRate: number | null;
}>;
export type ContentHealthData = Readonly<{ areas: readonly ContentHealthArea[]; staleAfterDays: 180 }>;

export interface ContentService {
  getAreas(): Promise<AnalyticsSourceResult<ContentArea[]>>;
  getArea(slug: string): Promise<AnalyticsSourceResult<ContentArea>>;
  getShops(options: { areaSlug?: string; status?: "publish"; limit?: number; page?: number }): Promise<AnalyticsSourceResult<ContentShopPage>>;
  getShop(idOrSlug: number | string): Promise<AnalyticsSourceResult<ContentShop>>;
  getApprovedReviews(options: { areaSlug?: string; shopId?: number; limit?: number }): Promise<AnalyticsSourceResult<ApprovedReviewSummary>>;
  getContentHealth(options?: { areaSlug?: string }): Promise<AnalyticsSourceResult<ContentHealthData>>;
}

export type WordPressAnalyticsResponse = Readonly<{
  status: number;
  body: unknown;
  pagination?: Readonly<{ total: number; totalPages: number }>;
}>;

/** The sole network seam. Tests inject a complete fake here and still exercise this adapter. */
export interface WordPressAnalyticsClient {
  request(path: string): Promise<WordPressAnalyticsResponse>;
}

export class WordPressAnalyticsRequestError extends Error {
  readonly state: "timeout" | "api_error";

  constructor(state: "timeout" | "api_error", message: string) {
    super(message);
    this.state = state;
  }
}

function warning(code: string, state: string): AnalyticsWarning[] {
  return [{ code, message: `state=${state}; code=${code}` }];
}

function fail<T>(state: AnalyticsFailureState, code: string): AnalyticsSourceResult<T> {
  return analyticsFailure(state, { warnings: warning(code, state) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalSlug(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}

function canonicalShopSlug(value: unknown): value is string {
  return typeof value === "string" && value !== "" && normalizePublicShopSlug(value) === value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const date = value.slice(0, 10);
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
}

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || value === "") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function validPage(value: unknown, fallback: number): number | null {
  const resolved = value ?? fallback;
  return positive(resolved) && resolved <= MAX_PAGE ? resolved : null;
}

function validLimit(value: unknown, fallback: number, maximum = MAX_PER_PAGE): number | null {
  const resolved = value ?? fallback;
  return positive(resolved) && resolved <= maximum ? resolved : null;
}

function responseState(status: number): AnalyticsFailureState | null {
  if (!Number.isInteger(status) || status < 100 || status > 599) return "invalid_response";
  if (status >= 200 && status < 300) return null;
  return status === 401 || status === 403 ? "auth_error" : "api_error";
}

function requestErrorState(error: unknown): "timeout" | "api_error" {
  if (error instanceof WordPressAnalyticsRequestError) return error.state;
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return name === "AbortError" ? "timeout" : "api_error";
}

function parseArea(value: unknown): ContentArea | null {
  if (!isRecord(value) || !positive(value.id) || !canonicalSlug(value.slug) || typeof value.name !== "string" || value.name.trim() === "" || !nonNegative(value.parent) || !nonNegative(value.count)) return null;
  return { id: value.id, slug: value.slug, name: value.name, parentId: value.parent, publishedShopCount: value.count };
}

function parseAreas(value: unknown): ContentArea[] | null {
  if (!Array.isArray(value)) return null;
  const ids = new Set<number>();
  const slugs = new Set<string>();
  const areas: ContentArea[] = [];
  for (const item of value) {
    const area = parseArea(item);
    if (!area || ids.has(area.id) || slugs.has(area.slug)) return null;
    ids.add(area.id); slugs.add(area.slug); areas.push(area);
  }
  return areas.sort((left, right) => left.slug.localeCompare(right.slug) || left.id - right.id);
}

function parsePagination(value: unknown, fallbackPage: number): { total: number; totalPages: number; page: number } | null {
  if (!isRecord(value) || !nonNegative(value.total) || !nonNegative(value.totalPages)) return null;
  const page = validPage(fallbackPage, fallbackPage);
  if (!page) return null;
  if ((value.total === 0 && value.totalPages !== 0) || (value.total > 0 && (value.totalPages < 1 || page > value.totalPages))) return null;
  return { total: value.total, totalPages: value.totalPages, page };
}

function rawShop(value: unknown): WpShop | null {
  if (!isRecord(value) || !positive(value.id) || !canonicalShopSlug(value.slug) || value.status !== "publish" || !validHttpUrl(value.link) ||
    !isRecord(value.title) || typeof value.title.rendered !== "string" || !isRecord(value.content) || typeof value.content.rendered !== "string" ||
    !validDate(value.date) || !validDate(value.modified) || (value.acf !== undefined && !isRecord(value.acf))) return null;
  if (value.area !== undefined && (!Array.isArray(value.area) || !value.area.every(positive))) return null;
  return value as unknown as WpShop;
}

function hasCurrentFact(model: ReturnType<typeof buildShopDetailViewModel>, field: typeof REQUIRED_FACTS[number]): boolean {
  if (field === "price") return model.prices.some((course) => course.price.status === "confirmed" && Number.isInteger(course.price.amount) && Number(course.price.amount) > 0);
  if (field === "hours") return model.infoRows.some((row) => row.key === "hours" && row.value.trim() !== "");
  if (field === "official") return model.actions.some((action) => action.kind === "official" && validHttpUrl(action.href));
  return model.infoRows.some((row) => (row.key === "station" || row.key === "address") && row.value.trim() !== "");
}

type VerifiedFacts = { price: boolean; hours: boolean; official: boolean; access: boolean; latest: string | null };

function verifiedFacts(shop: WpShop): VerifiedFacts {
  const normalized = normalizeShop(shop);
  const model = buildShopDetailViewModel(normalized, "");
  const coverage = buildShopInformationCoverage(model, normalized.acf.shop_fact_provenance);
  const coverageByKey = new Map(coverage?.items.map((item) => [item.key, item.verified]) ?? []);
  const latestByField = new Map<ShopFactField, string>();
  const source = normalized.acf.shop_fact_provenance;
  if (Array.isArray(source)) {
    for (const item of source) {
      if (!isRecord(item) || !REQUIRED_FACTS.includes(item.field as typeof REQUIRED_FACTS[number]) || item.reviewStatus !== "reviewed" ||
        !FACT_SOURCE_TYPES.has(String(item.sourceType)) || !validHttpUrl(item.sourceUrl) || !validDate(item.observedAt) || !validDate(item.reviewedAt) ||
        typeof item.publishedValueHash !== "string" || !/^[a-f0-9]{64}$/u.test(item.publishedValueHash)) continue;
      const field = item.field as ShopFactField;
      if (item.publishedValueHash !== hashShopFactValue(field, model) || !hasCurrentFact(model, field as typeof REQUIRED_FACTS[number]) || !coverageByKey.get(field)) continue;
      const current = latestByField.get(field);
      if (!current || Date.parse(item.reviewedAt) > Date.parse(current)) latestByField.set(field, item.reviewedAt);
    }
  }
  const verified = {
    price: latestByField.has("price"), hours: latestByField.has("hours"), official: latestByField.has("official"), access: latestByField.has("access"),
  };
  const dates = [...latestByField.values()].sort((left, right) => Date.parse(right) - Date.parse(left));
  return { ...verified, latest: dates[0] ?? null };
}

function contentShop(value: unknown): ContentShop | null {
  const shop = rawShop(value);
  if (!shop) return null;
  const facts = verifiedFacts(shop);
  const title = normalizeShop(shop).title;
  if (!title) return null;
  return {
    id: shop.id,
    slug: shop.slug,
    title,
    verified: { price: facts.price, hours: facts.hours, officialUrl: facts.official, access: facts.access },
    latestVerifiedRequiredFactAt: facts.latest,
  };
}

function compareShops(left: ContentShop, right: ContentShop): number {
  return left.slug.localeCompare(right.slug) || left.id - right.id;
}

function toStale(date: string | null, now: Date): boolean {
  if (!date) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const threshold = new Date(Date.UTC(year, month - 1, day - 180)).toISOString().slice(0, 10);
  return date.slice(0, 10) < threshold;
}

function defaultWordPressClient(): WordPressAnalyticsClient {
  return {
    async request(path) {
      try {
        const result = await wpFetchPaginated<unknown>(path);
        return { status: 200, body: result.data, pagination: result.pagination };
      } catch (error) {
        const message = error instanceof Error ? error.message : "WordPress request failed";
        const status = /WordPress fetch failed: (\d{3})\b/u.exec(message)?.[1];
        if (status) return { status: Number(status), body: null };
        throw new WordPressAnalyticsRequestError(requestErrorState(error), message);
      }
    },
  };
}

export class WordPressAdapter implements ContentService {
  private readonly client: WordPressAnalyticsClient;
  private readonly now: () => Date;

  constructor(options: { client?: WordPressAnalyticsClient; now?: () => Date } = {}) {
    this.client = options.client ?? defaultWordPressClient();
    this.now = options.now ?? (() => new Date());
  }

  private async fetch(path: string): Promise<{ ok: true; response: WordPressAnalyticsResponse } | { ok: false; state: AnalyticsFailureState; code: string }> {
    try {
      const response = await this.client.request(path);
      const state = responseState(response.status);
      return state ? { ok: false, state, code: `wordpress_http_${response.status}` } : { ok: true, response };
    } catch (error) {
      const state = requestErrorState(error);
      return { ok: false, state, code: state === "timeout" ? "wordpress_timeout" : "wordpress_request_failed" };
    }
  }

  async getAreas(): Promise<AnalyticsSourceResult<ContentArea[]>> {
    const all: ContentArea[] = [];
    const ids = new Set<number>();
    const slugs = new Set<string>();
    let expectedTotal: number | null = null;
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page += 1) {
      if (page > MAX_PAGE) return fail("invalid_response", "wordpress_areas_pagination_cap");
      const result = await this.fetch(`/wp/v2/area?per_page=${MAX_PER_PAGE}&hide_empty=false&page=${page}`);
      if (!result.ok) return fail(result.state, result.code);
      const pagination = parsePagination(result.response.pagination, page);
      const areas = parseAreas(result.response.body);
      if (!pagination || !areas || pagination.totalPages !== (pagination.total === 0 ? 0 : Math.ceil(pagination.total / MAX_PER_PAGE))) {
        return fail("invalid_response", "wordpress_areas_invalid_pagination");
      }
      if (pagination.totalPages > MAX_PAGE) return fail("invalid_response", "wordpress_areas_pagination_cap");
      const expectedCount = pagination.total === 0 ? 0 : Math.min(MAX_PER_PAGE, pagination.total - ((page - 1) * MAX_PER_PAGE));
      if (expectedCount < 0 || areas.length !== expectedCount || (expectedTotal !== null && (expectedTotal !== pagination.total || totalPages !== pagination.totalPages))) {
        return fail("invalid_response", "wordpress_areas_inconsistent_pagination");
      }
      expectedTotal = pagination.total;
      totalPages = pagination.totalPages;
      for (const area of areas) {
        if (ids.has(area.id) || slugs.has(area.slug)) return fail("invalid_response", "wordpress_areas_duplicate_across_pages");
        ids.add(area.id); slugs.add(area.slug); all.push(area);
      }
    }
    return all.length === 0 ? fail("no_data", "wordpress_areas_no_data") : analyticsSuccess(all.sort((left, right) => left.slug.localeCompare(right.slug) || left.id - right.id));
  }

  async getArea(slug: string): Promise<AnalyticsSourceResult<ContentArea>> {
    if (!canonicalSlug(slug)) return fail("invalid_response", "wordpress_area_invalid_slug");
    const result = await this.fetch(`/wp/v2/area?slug=${encodeURIComponent(slug)}&hide_empty=false`);
    if (!result.ok) return fail(result.state, result.code);
    const areas = parseAreas(result.response.body);
    if (!areas) return fail("invalid_response", "wordpress_area_invalid_response");
    if (areas.length === 0) return fail("no_data", "wordpress_area_no_data");
    if (areas.length !== 1 || areas[0].slug !== slug) return fail("invalid_response", "wordpress_area_ambiguous_response");
    return analyticsSuccess(areas[0]);
  }

  private async shopPage(areaId: number | null, limit: number, page: number): Promise<AnalyticsSourceResult<ContentShopPage>> {
    const query = new URLSearchParams({ status: "publish", per_page: String(limit), page: String(page), orderby: "id", order: "asc", _embed: "1" });
    if (areaId !== null) query.set("area", String(areaId));
    const result = await this.fetch(`/wp/v2/shop?${query.toString()}`);
    if (!result.ok) return fail(result.state, result.code);
    const pagination = parsePagination(result.response.pagination, page);
    if (!pagination || !Array.isArray(result.response.body)) return fail("invalid_response", "wordpress_shops_invalid_pagination");
    if (pagination.totalPages !== (pagination.total === 0 ? 0 : Math.ceil(pagination.total / limit))) {
      return fail("invalid_response", "wordpress_shops_inconsistent_pagination");
    }
    const shops: ContentShop[] = [];
    const ids = new Set<number>();
    const slugs = new Set<string>();
    for (const item of result.response.body) {
      const shop = contentShop(item);
      if (!shop || ids.has(shop.id) || slugs.has(shop.slug)) return fail("invalid_response", "wordpress_shops_invalid_or_duplicate");
      ids.add(shop.id); slugs.add(shop.slug); shops.push(shop);
    }
    const expected = pagination.total === 0 ? 0 : Math.min(limit, pagination.total - ((page - 1) * limit));
    if (expected < 0 || shops.length !== expected) return fail("invalid_response", "wordpress_shops_inconsistent_page");
    const data = { shops: shops.sort(compareShops), ...pagination };
    return pagination.total === 0 ? fail("no_data", "wordpress_shops_no_data") : analyticsSuccess(data);
  }

  async getShops(options: { areaSlug?: string; status?: "publish"; limit?: number; page?: number } = {}): Promise<AnalyticsSourceResult<ContentShopPage>> {
    if (options.status !== undefined && options.status !== "publish") return fail("invalid_response", "wordpress_shops_invalid_status");
    const limit = validLimit(options.limit, MAX_PER_PAGE);
    const page = validPage(options.page, 1);
    if (!limit || !page) return fail("invalid_response", "wordpress_shops_invalid_options");
    let areaId: number | null = null;
    if (options.areaSlug !== undefined) {
      const area = await this.getArea(options.areaSlug);
      if (area.data === null) return area as AnalyticsSourceResult<ContentShopPage>;
      areaId = area.data.id;
    }
    return this.shopPage(areaId, limit, page);
  }

  async getShop(idOrSlug: number | string): Promise<AnalyticsSourceResult<ContentShop>> {
    const path = typeof idOrSlug === "number" && positive(idOrSlug)
      ? `/wp/v2/shop/${idOrSlug}?_embed=1`
      : typeof idOrSlug === "string" && canonicalShopSlug(idOrSlug)
        ? `/wp/v2/shop?slug=${encodeURIComponent(idOrSlug)}&status=publish&_embed=1`
        : null;
    if (!path) return fail("invalid_response", "wordpress_shop_invalid_identifier");
    const result = await this.fetch(path);
    if (!result.ok) return fail(result.state, result.code);
    const value = typeof idOrSlug === "number" ? result.response.body : (() => {
      const entries = Array.isArray(result.response.body) ? result.response.body : null;
      return entries?.length === 1 ? entries[0] : entries?.length === 0 ? null : undefined;
    })();
    if (value === null) return fail("no_data", "wordpress_shop_no_data");
    const shop = contentShop(value);
    if (!shop || (typeof idOrSlug === "string" && shop.slug !== idOrSlug) || (typeof idOrSlug === "number" && shop.id !== idOrSlug)) return fail("invalid_response", "wordpress_shop_invalid_response");
    return analyticsSuccess(shop);
  }

  async getApprovedReviews(options: { areaSlug?: string; shopId?: number; limit?: number } = {}): Promise<AnalyticsSourceResult<ApprovedReviewSummary>> {
    if (options.areaSlug !== undefined && !canonicalSlug(options.areaSlug)) return fail("invalid_response", "wordpress_reviews_invalid_area_slug");
    if (options.shopId !== undefined && !positive(options.shopId)) return fail("invalid_response", "wordpress_reviews_invalid_shop_id");
    const limit = validLimit(options.limit, REVIEW_PER_PAGE, REVIEW_PER_PAGE);
    if (!limit) return fail("invalid_response", "wordpress_reviews_invalid_limit");
    const getPage = async (pageNumber: number) => {
      const query = new URLSearchParams({ page: String(pageNumber), per_page: String(limit) });
      if (options.areaSlug) query.set("primary_area_slug", options.areaSlug);
      const result = await this.fetch(`/escomi/v1/reviews?${query.toString()}`);
      if (!result.ok) return fail<NonNullable<ReturnType<typeof validateApprovedGlobalReviewPage>>>(result.state, result.code);
      const page = validateApprovedGlobalReviewPage(result.response.body, pageNumber, limit, options.areaSlug ?? null);
      return page ? analyticsSuccess(page) : fail<NonNullable<ReturnType<typeof validateApprovedGlobalReviewPage>>>("invalid_response", "wordpress_reviews_invalid_response");
    };
    const first = await getPage(1);
    if (first.data === null) return first as AnalyticsSourceResult<ApprovedReviewSummary>;
    if (first.data.totalPages > MAX_PAGE) return fail("invalid_response", "wordpress_reviews_pagination_cap");
    const pages = [first.data];
    for (let page = 2; page <= first.data.totalPages; page += 1) {
      const next = await getPage(page);
      if (next.data === null) return next as AnalyticsSourceResult<ApprovedReviewSummary>;
      if (next.data.total !== first.data.total || next.data.totalPages !== first.data.totalPages) {
        return fail("invalid_response", "wordpress_reviews_inconsistent_pagination");
      }
      pages.push(next.data);
    }
    const reviewIds = new Set<number>();
    const reviews = pages.flatMap((page) => page.reviews)
      .filter((review) => {
        if (reviewIds.has(review.id)) return false;
        reviewIds.add(review.id);
        return options.shopId === undefined || review.shop.id === options.shopId;
      })
      .map((review) => ({ id: review.id, shopId: review.shop.id, shopSlug: review.shop.slug, areaSlugs: review.areas.map((area) => area.slug).sort() }))
      .sort((left, right) => left.shopSlug.localeCompare(right.shopSlug) || left.id - right.id);
    if (new Set(pages.flatMap((page) => page.reviews.map((review) => review.id))).size !== pages.flatMap((page) => page.reviews).length) {
      return fail("invalid_response", "wordpress_reviews_duplicate_across_pages");
    }
    const total = options.shopId === undefined ? first.data.total : reviews.length;
    const data = { total, totalPages: options.shopId === undefined ? first.data.totalPages : (total === 0 ? 0 : 1), page: 1, reviews };
    return total === 0 ? fail("no_data", "wordpress_reviews_no_data") : analyticsSuccess(data);
  }

  private async allPublishedShops(area: ContentArea): Promise<AnalyticsSourceResult<ContentShop[]>> {
    const all: ContentShop[] = [];
    const ids = new Set<number>();
    const slugs = new Set<string>();
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.shopPage(area.id, MAX_PER_PAGE, page);
      if (result.state === "no_data") return analyticsSuccess([]);
      if (result.data === null) return result as AnalyticsSourceResult<ContentShop[]>;
      totalPages = result.data.totalPages;
      for (const shop of result.data.shops) {
        if (ids.has(shop.id) || slugs.has(shop.slug)) return fail("invalid_response", "wordpress_shops_duplicate_across_pages");
        ids.add(shop.id); slugs.add(shop.slug); all.push(shop);
      }
      page += 1;
    } while (page <= totalPages && page <= MAX_PAGE);
    if (page <= totalPages) return fail("invalid_response", "wordpress_shops_pagination_cap");
    return analyticsSuccess(all.sort(compareShops));
  }

  async getContentHealth(options: { areaSlug?: string } = {}): Promise<AnalyticsSourceResult<ContentHealthData>> {
    let areas: ContentArea[];
    if (options.areaSlug !== undefined) {
      const area = await this.getArea(options.areaSlug);
      if (area.data === null) return area as AnalyticsSourceResult<ContentHealthData>;
      areas = [area.data];
    } else {
      const result = await this.getAreas();
      if (result.data === null) return result as AnalyticsSourceResult<ContentHealthData>;
      areas = result.data;
    }
    const data: ContentHealthArea[] = [];
    for (const area of areas) {
      const shops = await this.allPublishedShops(area);
      if (shops.data === null) return shops as AnalyticsSourceResult<ContentHealthData>;
      if (area.publishedShopCount !== shops.data.length) {
        return fail("invalid_response", "wordpress_content_health_published_shop_count_mismatch");
      }
      const reviews = await this.getApprovedReviews({ areaSlug: area.slug });
      if (reviews.state !== "ok" && reviews.state !== "no_data") return reviews as AnalyticsSourceResult<ContentHealthData>;
      const publishedShops = shops.data.length;
      const verifiedPriceCount = shops.data.filter((shop) => shop.verified.price).length;
      const verifiedHoursCount = shops.data.filter((shop) => shop.verified.hours).length;
      const verifiedOfficialUrlCount = shops.data.filter((shop) => shop.verified.officialUrl).length;
      const verifiedAccessCount = shops.data.filter((shop) => shop.verified.access).length;
      const knownFacts = verifiedPriceCount + verifiedHoursCount + verifiedOfficialUrlCount + verifiedAccessCount;
      const missingRate = publishedShops === 0 ? null : (publishedShops * REQUIRED_FACTS.length - knownFacts) / (publishedShops * REQUIRED_FACTS.length);
      data.push({
        area, publishedShops, verifiedPriceCount, verifiedHoursCount, verifiedOfficialUrlCount, verifiedAccessCount,
        approvedReviewCount: reviews.data?.total ?? 0,
        staleConfirmedDateShopCount: shops.data.filter((shop) => toStale(shop.latestVerifiedRequiredFactAt, this.now())).length,
        missingRate,
      });
    }
    return analyticsSuccess({ areas: data.sort((left, right) => left.area.slug.localeCompare(right.area.slug) || left.area.id - right.area.id), staleAfterDays: 180 });
  }
}

export function createWordPressContentService(options: { client?: WordPressAnalyticsClient; now?: () => Date } = {}): ContentService {
  return new WordPressAdapter(options);
}
