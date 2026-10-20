import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migrationPath = resolve(root, "../supabase/migrations/20261020030000_eskomi_public_review_read_rpc.sql");
const transportPath = resolve(root, "lib/supabase/public-review-read.ts");

assert.ok(existsSync(migrationPath), "public review read RPC migration must exist");
assert.ok(existsSync(transportPath), "publishable-key review transport must exist");

const migration = read("../supabase/migrations/20261020030000_eskomi_public_review_read_rpc.sql");
assert.doesNotMatch(migration, /create table|create trigger|create view|\b(?:insert|update|delete|truncate|drop)\s+(?:into\s+)?(?:app|private)\./iu, "the public-reader migration must not invent an unsynchronised projection or mutate existing data");
for (const dependency of [
  "app.review_experience_publications",
  "private.review_experience_revisions",
  "private.review_experience_reply_revisions",
  "private.managed_shops",
  "private.managed_shop_publications",
]) {
  assert.match(migration, new RegExp(`\\b${dependency.replaceAll(".", "\\.")}\\b`, "u"), `public reader must query the canonical v1.1 dependency ${dependency}`);
}
assert.match(migration, /security definer\s+set search_path\s*=\s*''/iu, "security-definer readers must use an empty search path and qualified names");
assert.doesNotMatch(migration, /enable row level security/iu, "the read migration must not alter canonical source-table RLS");
const historicalV11Migrations = readdirSync(resolve(root, "../supabase/migrations"))
  .filter((name) => /^202610171(?:2|3|4|5)\d{4}_.*\.sql$/u.test(name));
assert.ok(historicalV11Migrations.length > 0, "the historical v1.1 migration chain must remain present for compatibility review");
const moderationSource = read("../supabase/migrations/20261017146000_eskomi_moderation_and_membership_race_fix.sql");
const publicationFoundation = read("../supabase/migrations/20261017130000_eskomi_v11_private_receipts_and_publications.sql");
assert.match(publicationFoundation, /alter table app\.review_experience_publications enable row level security/iu, "canonical publication source must retain RLS");
assert.match(moderationSource, /if p_decision='approved' then insert into app\.review_experience_publications[\s\S]*?'published'/iu, "approval must create or publish the canonical source row");
assert.match(moderationSource, /update app\.review_experience_publications set publication_state='hidden'/iu, "withdrawal must hide the canonical source row");
for (const signature of [
  /api\.list_public_review_experience_publications_global\(\s*integer,\s*integer,\s*text\)/u,
  /api\.count_public_review_experience_publications_global\(\s*text\)/u,
  /api\.list_public_shop_detail_reviews_v11\(\s*text,\s*integer,\s*integer\)/u,
  /api\.get_public_shop_detail_review_summary_v11\(\s*text\)/u,
]) {
  assert.match(migration, signature, `${signature} must be explicitly governed`);
}
assert.match(migration, /security definer/iu, "public projections must not require direct private-table grants");
assert.match(migration, /grant execute on function[\s\S]*to anon, authenticated/iu, "only the four public read RPCs may be granted to public roles");
assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)\s+on\s+(?:app|private)\./iu, "public review migration must not widen table privileges");
for (const forbidden of ["email", "receipt", "session_secret", "idempotency", "ip_prefix", "device_fingerprint", "edit_token", "moderation_reason", "approved_by"]) {
  assert.doesNotMatch(migration, new RegExp(`returns table[\\s\\S]*?\\b${forbidden}\\b`, "iu"), `public RPC return contracts must not include ${forbidden}`);
}

const transportSource = read("lib/supabase/public-review-read.ts");
assert.doesNotMatch(transportSource, /SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)/u, "public review transport must never read a server secret");
assert.match(read("lib/supabase/eskomi-review-v2.ts"), /public-review-read/u, "global public reviews must use the publishable-key transport");
assert.match(read("lib/supabase/eskomi-public-shop-detail-reviews-v11.ts"), /public-review-read/u, "shop-detail public reviews must use the publishable-key transport");

function loadTransport() {
  const output = ts.transpileModule(transportSource, {
    fileName: transportPath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => { throw new Error(`unexpected dependency: ${specifier}`); }, module, module.exports);
  return module.exports;
}

const transport = loadTransport();
assert.equal(transport.resolvePublicReviewReadTransport({}), null);
assert.equal(transport.resolvePublicReviewReadTransport({ CONTENT_DATA_SOURCE: "supabase" }), null, "missing public config must fail closed");
const configured = transport.resolvePublicReviewReadTransport({
  CONTENT_DATA_SOURCE: "supabase",
  SUPABASE_CONTENT_URL: "https://example.supabase.co/",
  SUPABASE_CONTENT_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "must-not-be-read",
});
assert.deepEqual(configured, { origin: "https://example.supabase.co", key: "publishable-test-key" });

const calls = [];
const result = await transport.requestPublicReviewRpc(configured, "list_public_review_experience_publications_global", { p_limit: 20, p_offset: 0, p_area_slug: null }, async (url, init) => {
  calls.push({ url, init });
  return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
});
assert.deepEqual(result, []);
assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/list_public_review_experience_publications_global");
assert.equal(calls[0].init.headers.apikey, "publishable-test-key");
assert.equal(calls[0].init.headers.Authorization, "Bearer publishable-test-key");
assert.equal(calls[0].init.headers["Content-Profile"], "api");
assert.equal(calls[0].init.cache, "no-store");

const v2Source = read("lib/supabase/eskomi-review-v2.ts");
const v2Output = ts.transpileModule(v2Source, {
  fileName: resolve(root, "lib/supabase/eskomi-review-v2.ts"),
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const v2Module = { exports: {} };
const v2Calls = [];
new Function("require", "module", "exports", v2Output)((specifier) => {
  if (specifier === "server-only") return {};
  if (specifier === "@/lib/supabase/public-review-read") return {
    resolvePublicReviewReadTransport: () => null,
    requestPublicReviewRpc: async (_transport, name, payload) => { v2Calls.push({ name, payload }); return []; },
  };
  if (specifier === "@/lib/supabase/server-secret") return { createSupabaseServerHeaders: () => ({}), resolveSupabaseServerSecret: () => null };
  throw new Error(`unexpected v2 dependency: ${specifier}`);
}, v2Module, v2Module.exports);
const v2Repository = v2Module.exports.createEskomiReviewV2Repository({
  baseUrl: undefined, serviceRoleKey: undefined, publicTransport: configured,
});
await v2Repository.listPublications("fixture-public-shop");
assert.equal(v2Calls[0].name, "list_public_shop_detail_reviews_v11", "public-key reads must use one of the four granted RPCs");

console.log("Eskomi public review read contract: PASS");
