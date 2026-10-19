import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const readerPath = join(root, "lib/content-source/public-directory.ts");
assert.ok(existsSync(readerPath), "Supabase-primary public directory reader must exist");

const reader = readFileSync(readerPath, "utf8");
assert.match(reader, /get_public_site_directory_v1/, "primary reader must use the dedicated public-only RPC");
assert.doesNotMatch(reader, /@\/lib\/wp\/(shops|areas|posts|client)/, "primary reader must not import a WordPress compatibility reader");
assert.match(reader, /SUPABASE_CONTENT_EXPECTED_SHOPS/, "primary reader must require an explicit shop migration count");
assert.match(reader, /SUPABASE_CONTENT_EXPECTED_AREAS/, "primary reader must require an explicit area migration count");
assert.match(reader, /SUPABASE_CONTENT_EXPECTED_POSTS/, "primary reader must require an explicit article migration count");
assert.match(reader, /SUPABASE_CONTENT_EXPECTED_PAGES/, "primary reader must require an explicit fixed-page migration count");
assert.match(reader, /ContentMigrationIncompleteError/, "missing or incomplete migrations must fail closed");

const migrationPath = join(root, "../supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql");
assert.ok(existsSync(migrationPath), "Supabase primary public-directory migration must exist");
const migration = readFileSync(migrationPath, "utf8");
assert.match(migration, /create(?:\s+or\s+replace)?\s+function api\.get_public_site_directory_v1\(\)/i);
assert.match(migration, /security definer/i, "public projection must not expose base tables directly");
assert.match(migration, /publication_status = 'published'/i, "only published records may enter the public projection");
assert.match(migration, /'pages'/, "public projection must include allowlisted fixed pages");
assert.match(migration, /grant execute on function api\.get_public_site_directory_v1\(\) to anon, authenticated/i);
assert.doesNotMatch(migration, /grant (select|insert|update|delete).* on (app|private)\./i, "migration must not widen table privileges");
assert.match(migration, /sa\.shop_id = s\.id and sa\.is_primary/i, "a shop must retain its authoritative primary-area assignment");
assert.match(migration, /'area_slugs'/, "public shops must expose every published existing area relation");
assert.match(migration, /'primary_area_slug'/, "primary area must be optional public metadata, not a publication gate");
assert.doesNotMatch(migration, /from published_shops where area_slug is not null/i, "shops without an explicit primary area must retain their canonical detail URL");
assert.match(migration, /parent\.id = a\.parent_id and parent\.is_published/i, "an unpublished parent must not be exposed in the public area hierarchy");
assert.match(migration, /private\.managed_shops/i, "primary projection must honor the established managed-shop visibility boundary");
assert.match(migration, /managed\.existing_wp_shop_id = s\.wp_post_id/i, "legacy managed identities must match the canonical app shop by WordPress ID");
assert.match(migration, /managed\.publication_state <> 'published'/i, "unlisted or deleted managed shops must be suppressed from the primary projection");

const shops = readFileSync(join(root, "lib/wp/shops.ts"), "utf8");
const areas = readFileSync(join(root, "lib/wp/areas.ts"), "utf8");
const posts = readFileSync(join(root, "lib/wp/posts.ts"), "utf8");
const pages = readFileSync(join(root, "lib/wp/pages.ts"), "utf8");
const home = readFileSync(join(root, "app/page.tsx"), "utf8");
const sitemap = readFileSync(join(root, "app/sitemap.ts"), "utf8");
const shopDetail = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
const seo = readFileSync(join(root, "lib/seo.ts"), "utf8");
const resilience = readFileSync(join(root, "lib/wp/build-resilience.ts"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");
for (const [name, source] of [["shops", shops], ["areas", areas], ["posts", posts]]) {
  assert.match(source, /isSupabasePrimaryContent/, `${name} reader must select the primary source before WordPress`);
  assert.match(source, /getSupabasePrimaryPublicDirectory/, `${name} reader must resolve the canonical Supabase directory`);
}
assert.match(shops, /export async function getAllShopsForListing[\s\S]*isSupabasePrimaryContent/, "shop listing must avoid WordPress in primary mode");
assert.match(shops, /export async function getShopBySlug[\s\S]*isSupabasePrimaryContent/, "shop detail must avoid WordPress in primary mode");
assert.match(shops, /export async function getShopsForSitemap[\s\S]*isSupabasePrimaryContent/, "shop sitemap must avoid WordPress in primary mode");
assert.match(areas, /export async function getAreaShops[\s\S]*isSupabasePrimaryContent/, "area listing must avoid WordPress in primary mode");
assert.match(areas, /publicDirectoryShops\(directory\)\.filter\(\(shop\) => shop\.terms\.some\(\(term\) => term\.slug === area\.slug\)\)/, "area listings must retain every published shop-area membership");
assert.match(posts, /export async function getPostsForSitemap[\s\S]*isSupabasePrimaryContent/, "article sitemap must avoid WordPress in primary mode");
assert.match(pages, /isSupabasePrimaryContent[\s\S]*ContentMigrationIncompleteError/, "unmigrated static pages must fail closed instead of reading WordPress in primary mode");
assert.match(pages, /getSupabasePrimaryPublicDirectory/, "fixed pages must resolve the canonical primary directory before WordPress");
assert.match(home, /isSupabasePrimaryContent\(\) \? Promise\.resolve\(\[\]\) : getHomeFeaturedAreas\(\)/, "home must skip the WordPress-only featured-area endpoint in primary mode");
assert.match(home, /isSupabasePrimaryContent\(\)[\s\S]*result\.status === "rejected"[\s\S]*throw result\.reason/, "home must not turn a failed primary read into an empty successful page");
assert.match(sitemap, /if \(isSupabasePrimaryContent\(\)\) \{[\s\S]*getSupabasePrimaryPublicDirectory\(\)[\s\S]*publicDirectoryAreas\(directory\)[\s\S]*directory\.shops[\s\S]*publicDirectoryPosts\(directory\)/, "primary sitemap must derive every public URL family from one directory read");
assert.match(sitemap, /catch \(error\) \{\s*if \(isSupabasePrimaryContent\(\)\) throw error;/, "sitemap must not hide a failed primary read behind an empty sitemap");
assert.match(shopDetail, /<Link href="\/shops\/">店舗情報<\/Link>/, "a shop detail must retain the generic store path before any area breadcrumb");
assert.match(shopDetail, /areaPath && primaryArea/, "a missing primary area must omit, not invent, the area breadcrumb");
assert.match(seo, /if \(shop\.primaryArea\)/, "breadcrumb JSON-LD must omit an unverified area rather than fabricate one");
assert.match(resilience, /isFailClosedPrimaryContentError/, "route fallback helpers must recognize a primary migration failure");
assert.match(envExample, /^SUPABASE_CONTENT_EXPECTED_SHOPS=/m, "primary reconciliation shop count must be documented");
assert.match(envExample, /^SUPABASE_CONTENT_EXPECTED_AREAS=/m, "primary reconciliation area count must be documented");
assert.match(envExample, /^SUPABASE_CONTENT_EXPECTED_POSTS=/m, "primary reconciliation article count must be documented");
assert.match(envExample, /^SUPABASE_CONTENT_EXPECTED_PAGES=/m, "primary reconciliation fixed-page count must be documented");

const executable = reader
  .replace('import "server-only";\n', "")
  .replace(/import \{ resolveContentReadPlan \} from "@\/lib\/content-source\/config";/, `
    const resolveContentReadPlan = (env) => ({
      primary: env.CONTENT_DATA_SOURCE === "supabase" && env.SUPABASE_CONTENT_CUTOVER_APPROVED === "true" ? "supabase" : "wordpress"
    });
  `)
  .replace(/import \{ normalizeShopRanking \} from "@\/lib\/shop-ranking";/, "const normalizeShopRanking = () => ({});")
  .replace(/import \{ unavailableStrictRanking \} from "@\/lib\/ux-production-data-boundary";/, "const unavailableStrictRanking = () => ({ state: 'unavailable' });")
  .replace(/import \{ STATIC_PAGE_SLUGS \} from "@\/lib\/static-pages";/, "const STATIC_PAGE_SLUGS = ['contact', 'about', 'sitemap', 'storelisting', 'advertise', 'osaka-nihonbashi'];")
  .replace(/import type \{[^;]+\} from "@\/lib\/wp\/types";/, "");
const compiled = ts.transpileModule(executable, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, process: { env: {} }, URL, Response, Math, Object, Set, Map, Array, Number, Error, console: { warn() {} } });
const { getSupabasePrimaryPublicDirectory, publicDirectoryAreas, publicDirectoryShops, publicDirectoryPage, ContentMigrationIncompleteError } = module.exports;
const fixture = {
  shops: [
    { id: "11111111-1111-4111-8111-111111111111", legacy_wp_shop_id: 768, slug: "primary-shop", canonical_path: "/shops/primary-shop/", name: "正本店舗", description_html: "<p>紹介</p>", excerpt: "紹介", official_url: null, image_url: null, area_slugs: ["osaka", "naniwa"], primary_area_slug: "osaka", modified_at: "2026-10-19T00:00:00Z" },
    { id: "55555555-5555-4555-8555-555555555555", legacy_wp_shop_id: 769, slug: "area-free-shop", canonical_path: "/shops/area-free-shop/", name: "地域未設定店舗", description_html: "<p>紹介</p>", excerpt: "紹介", official_url: null, image_url: null, area_slugs: [], primary_area_slug: null, modified_at: "2026-10-19T00:00:00Z" }
  ],
  areas: [
    { id: "22222222-2222-4222-8222-222222222222", slug: "osaka", name: "大阪", description: "", parent_slug: null },
    { id: "66666666-6666-4666-8666-666666666666", slug: "naniwa", name: "難波", description: "", parent_slug: null }
  ],
  posts: [{ id: "33333333-3333-4333-8333-333333333333", route_key: "/column/primary-article/", title: "正本記事", body_html: "<p>本文</p>", body_text: "本文", modified_at: "2026-10-19T00:00:00Z" }],
  pages: ["contact", "about", "sitemap", "storelisting", "advertise", "osaka-nihonbashi"].map((slug, index) => ({ id: `44444444-4444-4444-8444-00000000000${index + 1}`, route_key: `/${slug}/`, title: slug === "contact" ? "お問い合わせ" : slug, body_html: "<p>本文</p>", body_text: "本文", modified_at: "2026-10-19T00:00:00Z" })),
  coverage: { published_shop_count: 2, published_area_count: 2, public_column_count: 1, public_static_page_count: 6, mapped_wp_shop_count: 2 }
};
const environment = {
  CONTENT_DATA_SOURCE: "supabase", SUPABASE_CONTENT_CUTOVER_APPROVED: "true",
  SUPABASE_CONTENT_URL: "https://fixture.supabase.co", SUPABASE_CONTENT_PUBLISHABLE_KEY: "public-fixture-key",
  SUPABASE_CONTENT_EXPECTED_SHOPS: "2", SUPABASE_CONTENT_EXPECTED_AREAS: "2", SUPABASE_CONTENT_EXPECTED_POSTS: "1", SUPABASE_CONTENT_EXPECTED_PAGES: "6"
};
const rpcCalls = [];
const fixtureFetch = async (url, init) => {
  rpcCalls.push({ url, init });
  return new Response(JSON.stringify(fixture), { status: 200 });
};
const directory = await getSupabasePrimaryPublicDirectory(environment, fixtureFetch);
assert.equal(rpcCalls.length, 1);
assert.match(rpcCalls[0].url, /\/rest\/v1\/rpc\/get_public_site_directory_v1$/);
assert.equal(rpcCalls[0].init.cache, "no-store");
assert.equal(rpcCalls[0].init.headers.apikey, "public-fixture-key");
const directoryShops = publicDirectoryShops(directory);
assert.equal(directoryShops.length, 2, "canonical shop detail routes must include area-free shops");
assert.equal(directoryShops[0].terms.map((term) => term.slug).join(","), "osaka,naniwa", "multiple existing area relations must be retained");
assert.equal(directoryShops[0].primaryArea?.slug, "osaka");
assert.equal(directoryShops[1].primaryArea, null, "missing primary area must not be inferred");
assert.equal(directoryShops[1].areaSlug, "", "generic detail navigation must not invent an area breadcrumb");
assert.equal(publicDirectoryAreas(directory).find((area) => area.slug === "naniwa")?.count, 1, "area listing membership must use all public relations, not only primary");
assert.equal(publicDirectoryPage(directory, "contact")?.title, "お問い合わせ");
await assert.rejects(
  () => getSupabasePrimaryPublicDirectory({ ...environment, SUPABASE_CONTENT_EXPECTED_POSTS: "2" }, async () => new Response(JSON.stringify(fixture), { status: 200 })),
  ContentMigrationIncompleteError,
);
let transientAttempts = 0;
const transientDirectory = await getSupabasePrimaryPublicDirectory(environment, async () => {
  transientAttempts += 1;
  if (transientAttempts === 1) throw new Error("fixture transport interrupted");
  return new Response(JSON.stringify(fixture), { status: 200 });
});
assert.equal(transientAttempts, 2, "one transient public-directory transport failure must retry once");
assert.equal(transientDirectory.shops.length, 2);

const compiledResilience = ts.transpileModule(
  resilience.replace(/import \{ isManagedShopSourceUnavailableError \} from "@\/lib\/shop-management-source";/, "const isManagedShopSourceUnavailableError = () => false;"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const resilienceModule = { exports: {} };
vm.runInNewContext(compiledResilience, { module: resilienceModule, exports: resilienceModule.exports, console, Error });
const migrationFailure = new Error("coverage mismatch");
migrationFailure.name = "ContentMigrationIncompleteError";
await assert.rejects(
  () => resilienceModule.exports.withWpBuildFallback("primary route", async () => { throw migrationFailure; }, []),
  /coverage mismatch/,
  "primary coverage failures must not fall back to an empty successful route",
);

console.log("supabase primary public directory contract: PASS");
