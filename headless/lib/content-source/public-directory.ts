import "server-only";

import { resolveContentReadPlan } from "@/lib/content-source/config";
import { normalizeShopRanking } from "@/lib/shop-ranking";
import { unavailableStrictRanking } from "@/lib/ux-production-data-boundary";
import type { AreaView, BlogPostView, ShopView, WpTerm } from "@/lib/wp/types";

type Environment = Readonly<Record<string, string | undefined>>;

type DirectoryArea = Readonly<{ id: string; slug: string; name: string; description: string; parent_slug: string | null }>;
type DirectoryShop = Readonly<{
  id: string; legacy_wp_shop_id: number | null; slug: string; canonical_path: string; name: string;
  description_html: string; excerpt: string; official_url: string | null; image_url: string | null;
  area_slug: string; area_name: string; modified_at: string;
}>;
type DirectoryPost = Readonly<{ id: string; route_key: string; title: string; body_html: string; body_text: string; modified_at: string }>;
type DirectoryCoverage = Readonly<{ published_shop_count: number; published_area_count: number; public_column_count: number; mapped_wp_shop_count: number }>;

export type SupabasePublicDirectory = Readonly<{
  shops: readonly DirectoryShop[];
  areas: readonly DirectoryArea[];
  posts: readonly DirectoryPost[];
  coverage: DirectoryCoverage;
}>;

export class ContentMigrationIncompleteError extends Error {
  constructor(message: string) { super(message); this.name = "ContentMigrationIncompleteError"; }
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function string(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function integer(value: unknown): number | null { return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null; }
function nullableInteger(value: unknown): number | null | undefined { return value === null ? null : integer(value) ?? undefined; }
function nullableString(value: unknown): string | null | undefined { return value === null ? null : string(value) ?? undefined; }

function stableNumericId(value: string): number {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) || 1;
}

function parseDirectory(value: unknown): SupabasePublicDirectory | null {
  if (!record(value) || !Array.isArray(value.shops) || !Array.isArray(value.areas) || !Array.isArray(value.posts) || !record(value.coverage)) return null;
  const areas = value.areas.map((entry): DirectoryArea | null => {
    if (!record(entry)) return null;
    const id = string(entry.id); const slug = string(entry.slug); const name = string(entry.name); const description = typeof entry.description === "string" ? entry.description : null;
    const parentSlug = nullableString(entry.parent_slug);
    return id && slug && name && description !== null && parentSlug !== undefined ? Object.freeze({ id, slug, name, description, parent_slug: parentSlug }) : null;
  });
  const shops = value.shops.map((entry): DirectoryShop | null => {
    if (!record(entry)) return null;
    const id = string(entry.id); const legacy = nullableInteger(entry.legacy_wp_shop_id); const slug = string(entry.slug); const path = string(entry.canonical_path); const name = string(entry.name);
    const description = typeof entry.description_html === "string" ? entry.description_html : null; const excerpt = typeof entry.excerpt === "string" ? entry.excerpt : null;
    const official = nullableString(entry.official_url); const image = nullableString(entry.image_url); const areaSlug = string(entry.area_slug); const areaName = string(entry.area_name); const modified = string(entry.modified_at);
    return id && legacy !== undefined && slug && path && name && description !== null && excerpt !== null && official !== undefined && image !== undefined && areaSlug && areaName && modified
      ? Object.freeze({ id, legacy_wp_shop_id: legacy, slug, canonical_path: path, name, description_html: description, excerpt, official_url: official, image_url: image, area_slug: areaSlug, area_name: areaName, modified_at: modified }) : null;
  });
  const posts = value.posts.map((entry): DirectoryPost | null => {
    if (!record(entry)) return null;
    const id = string(entry.id); const route = string(entry.route_key); const title = string(entry.title); const bodyHtml = typeof entry.body_html === "string" ? entry.body_html : null; const bodyText = typeof entry.body_text === "string" ? entry.body_text : null; const modified = string(entry.modified_at);
    return id && route && title && bodyHtml !== null && bodyText !== null && modified ? Object.freeze({ id, route_key: route, title, body_html: bodyHtml, body_text: bodyText, modified_at: modified }) : null;
  });
  const coverage = {
    published_shop_count: integer(value.coverage.published_shop_count), published_area_count: integer(value.coverage.published_area_count),
    public_column_count: integer(value.coverage.public_column_count), mapped_wp_shop_count: integer(value.coverage.mapped_wp_shop_count),
  };
  if (areas.some((entry) => entry === null) || shops.some((entry) => entry === null) || posts.some((entry) => entry === null)
    || Object.values(coverage).some((entry) => entry === null)) return null;
  return Object.freeze({ shops: Object.freeze(shops as DirectoryShop[]), areas: Object.freeze(areas as DirectoryArea[]), posts: Object.freeze(posts as DirectoryPost[]), coverage: Object.freeze(coverage as DirectoryCoverage) });
}

function expectedCount(environment: Environment, name: "SUPABASE_CONTENT_EXPECTED_SHOPS" | "SUPABASE_CONTENT_EXPECTED_AREAS" | "SUPABASE_CONTENT_EXPECTED_POSTS"): number {
  const value = environment[name]?.trim() ?? "";
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new ContentMigrationIncompleteError(`${name} must be an explicit non-negative integer before Supabase-primary can start`);
  return Number(value);
}

function assertCoverage(directory: SupabasePublicDirectory, environment: Environment): void {
  const expectedShops = expectedCount(environment, "SUPABASE_CONTENT_EXPECTED_SHOPS");
  const expectedAreas = expectedCount(environment, "SUPABASE_CONTENT_EXPECTED_AREAS");
  const expectedPosts = expectedCount(environment, "SUPABASE_CONTENT_EXPECTED_POSTS");
  const actual = directory.coverage;
  if (actual.published_shop_count !== expectedShops || directory.shops.length !== expectedShops) throw new ContentMigrationIncompleteError(`Supabase-primary shop migration is incomplete: expected ${expectedShops}, received ${actual.published_shop_count}`);
  if (actual.published_area_count !== expectedAreas || directory.areas.length !== expectedAreas) throw new ContentMigrationIncompleteError(`Supabase-primary area migration is incomplete: expected ${expectedAreas}, received ${actual.published_area_count}`);
  if (actual.public_column_count !== expectedPosts || directory.posts.length !== expectedPosts) throw new ContentMigrationIncompleteError(`Supabase-primary article migration is incomplete: expected ${expectedPosts}, received ${actual.public_column_count}`);
  if (expectedShops > 0 && actual.mapped_wp_shop_count !== expectedShops) throw new ContentMigrationIncompleteError(`Supabase-primary requires a legacy WordPress identity for every migrated shop: expected ${expectedShops}, received ${actual.mapped_wp_shop_count}`);
}

export function isSupabasePrimaryContent(environment: Environment = process.env): boolean {
  return resolveContentReadPlan(environment).primary === "supabase";
}

export async function getSupabasePrimaryPublicDirectory(environment: Environment = process.env, fetchImpl: typeof fetch = fetch): Promise<SupabasePublicDirectory> {
  const plan = resolveContentReadPlan(environment);
  if (plan.primary !== "supabase") throw new ContentMigrationIncompleteError("Supabase-primary directory was requested while CONTENT_DATA_SOURCE is not supabase");
  const base = environment.SUPABASE_CONTENT_URL?.trim(); const key = environment.SUPABASE_CONTENT_PUBLISHABLE_KEY?.trim();
  if (!base || !key) throw new ContentMigrationIncompleteError("Supabase-primary public reader is not configured");
  let response: Response;
  try {
    response = await fetchImpl(`${new URL(base).origin}/rest/v1/rpc/get_public_site_directory_v1`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" }, body: "{}", cache: "no-store" });
  } catch { throw new ContentMigrationIncompleteError("Supabase-primary public directory could not be read"); }
  if (!response.ok) throw new ContentMigrationIncompleteError(`Supabase-primary public directory returned HTTP ${response.status}`);
  const directory = parseDirectory(await response.json());
  if (!directory) throw new ContentMigrationIncompleteError("Supabase-primary public directory response violates the public contract");
  assertCoverage(directory, environment);
  return directory;
}

export function publicDirectoryAreas(directory: SupabasePublicDirectory): AreaView[] {
  const ids = new Map(directory.areas.map((area) => [area.slug, stableNumericId(area.id)]));
  return directory.areas.map((area) => ({ id: ids.get(area.slug) as number, slug: area.slug, name: area.name, parent: area.parent_slug ? ids.get(area.parent_slug) ?? 0 : 0, count: directory.shops.filter((shop) => shop.area_slug === area.slug).length, description: area.description, acf: {} }));
}

export function publicDirectoryShops(directory: SupabasePublicDirectory): ShopView[] {
  const terms: WpTerm[] = publicDirectoryAreas(directory).map((area) => ({ id: area.id, slug: area.slug, name: area.name, parent: area.parent, count: area.count, description: area.description, acf: {} }));
  return directory.shops.map((shop) => {
    const primary = terms.find((area) => area.slug === shop.area_slug) ?? null;
    const imageUrl = shop.image_url ?? "";
    return { id: shop.legacy_wp_shop_id ?? stableNumericId(shop.id), canonicalShopId: shop.id, publicationStatus: "publish", slug: shop.slug, link: shop.canonical_path, title: shop.name, contentHtml: shop.description_html, excerpt: shop.excerpt, imageUrl, media: { cardSquare: { mediaId: null, source: imageUrl ? "legacy-acf" : "fallback", url: imageUrl, alt: shop.name }, detailBanner: null }, terms: primary ? [primary] : [], acf: {}, officialUrl: shop.official_url ?? "", areaSlug: shop.area_slug, primaryArea: primary ? { id: primary.id, slug: primary.slug, name: primary.name } : null, ranking: normalizeShopRanking({}), strictRanking: unavailableStrictRanking("shop") };
  });
}

export function publicDirectoryPosts(directory: SupabasePublicDirectory): BlogPostView[] {
  return directory.posts.map((post) => ({ id: stableNumericId(post.id), slug: post.route_key.split("/").filter(Boolean).at(-1) as string, link: post.route_key, title: post.title, date: post.modified_at, modified: post.modified_at, contentHtml: post.body_html, excerpt: post.body_text.slice(0, 160), imageUrl: "", terms: [], acf: {} }));
}
