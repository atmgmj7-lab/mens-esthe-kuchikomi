import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const filename = join(root, "lib/supabase/managed-shop-directory.ts");
const source = readFileSync(filename, "utf8")
  .replace('import "server-only";\n', "")
  .replace(/import \{[\s\S]*?\} from "@\/lib\/supabase\/server-secret";/, `
    const createSupabaseServerHeaders = (secret, headers = {}) => ({ ...headers, apikey: secret, Authorization: 'Bearer ' + secret });
    const resolveSupabaseServerSecret = (environment) => environment.SUPABASE_SERVICE_ROLE_KEY ? { value: environment.SUPABASE_SERVICE_ROLE_KEY } : null;
  `);
const output = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports, URL, fetch, Headers, process: { env: {} } });
const { createManagedShopDirectoryRepository, useSupabaseManagedShopDirectory } = module.exports;

assert.equal(useSupabaseManagedShopDirectory({ SHOP_DIRECTORY_SOURCE: "supabase" }), true);
assert.equal(useSupabaseManagedShopDirectory({ SHOP_DIRECTORY_SOURCE: "wordpress" }), false);

const calls = [];
const publication = {
  managed_shop_id: "11111111-1111-4111-8111-111111111111", directory_id: 1_000_000_001, existing_wp_shop_id: 768,
  shop_slug: "managed-rank-up", canonical_url: "https://mens-esthe-kuchikomi.com/shops/managed-rank-up/", approved_revision: 3,
  shop_name: "管理済み店舗", area_slug: "osaka", area_name: "大阪市", official_url: "https://example.test/official",
  introduction: "承認済み紹介文", address: "大阪市", business_hours: "10:00〜翌2:00", phone: "06-0000-0000",
  line_url: null, booking_url: "https://example.test/booking", basic_price: 12000, price_90: 15000,
  banner_asset_id: null, gallery_asset_ids: [],
};
const repository = createManagedShopDirectoryRepository({
  environment: { SUPABASE_URL: "http://127.0.0.1:57321", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", SHOP_DIRECTORY_SOURCE: "supabase" },
  fetchImpl: async (url, init) => {
    calls.push({ url, init });
    const method = new URL(url).pathname.split("/").at(-1);
    if (method === "list_published_managed_shops") return new Response(JSON.stringify([publication]), { status: 200 });
    if (method === "list_unlisted_managed_shop_legacy_identities") return new Response(JSON.stringify([{ existing_wp_shop_id: 999, shop_slug: "paused-legacy-shop" }]), { status: 200 });
    if (method === "list_managed_shop_legacy_listing_states") return new Response(JSON.stringify([{ existing_wp_shop_id: 999, shop_slug: "paused-legacy-shop", publication_state: "deleted" }]), { status: 200 });
    if (method === "import_managed_shop_from_legacy") return new Response(JSON.stringify("11111111-1111-4111-8111-111111111111"), { status: 200 });
    if (method === "create_and_publish_managed_shop" || method === "import_and_publish_managed_shop_from_legacy") return new Response(JSON.stringify("11111111-1111-4111-8111-111111111111"), { status: 200 });
    if (method === "save_managed_shop_draft") return new Response(JSON.stringify("conflict"), { status: 200 });
    if (method === "save_and_publish_managed_shop") return new Response(JSON.stringify("ok"), { status: 200 });
    return new Response(JSON.stringify("ok"), { status: 200 });
  },
});

assert.deepEqual(JSON.parse(JSON.stringify(await repository.listPublished())), [publication]);
assert.equal(await repository.importLegacy({ wpShopId: 768, slug: "managed-rank-up", payload: { shop_name: "管理済み店舗" }, actorLabel: "operator" }), "11111111-1111-4111-8111-111111111111");
assert.equal(await repository.saveDraft({ managedShopId: "11111111-1111-4111-8111-111111111111", expectedRevision: 3, payload: { shop_name: "管理済み店舗" }, actorLabel: "operator" }), "conflict");
assert.equal(await repository.createAndPublish({ slug: "managed-rank-up", payload: { shop_name: "管理済み店舗" }, actorLabel: "operator" }), "11111111-1111-4111-8111-111111111111");
assert.equal(await repository.importAndPublishLegacy({ wpShopId: 768, slug: "managed-rank-up", payload: { shop_name: "管理済み店舗" }, actorLabel: "operator" }), "11111111-1111-4111-8111-111111111111");
assert.equal(await repository.saveAndPublish({ managedShopId: "11111111-1111-4111-8111-111111111111", expectedRevision: 3, payload: { shop_name: "管理済み店舗" }, actorLabel: "operator" }), "ok");
assert.equal(calls.length, 6);
assert.ok(calls.every(({ init }) => init.headers.Authorization === "Bearer fixture-service"), "service secret must remain server-only RPC auth");
assert.equal(calls[0].init.cache, "force-cache", "published directory reads must remain cacheable inside Next use-cache boundaries");
assert.equal(calls[1].init.cache, "no-store", "operator mutations must not share a public directory cache");
assert.equal(calls[2].init.cache, "no-store", "draft writes must stay uncached");
assert.equal(calls[3].init.cache, "no-store", "direct publication must stay uncached");
assert.equal(calls[4].init.cache, "no-store", "legacy direct publication must stay uncached");
assert.equal(calls[5].init.cache, "no-store", "direct edit publication must stay uncached");
assert.equal((await repository.listPublished()).length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(await repository.listUnlistedLegacySuppressions())), [{ existing_wp_shop_id: 999, shop_slug: "paused-legacy-shop" }]);
assert.deepEqual(JSON.parse(JSON.stringify(await repository.listLegacyListingStates())), [{ existing_wp_shop_id: 999, shop_slug: "paused-legacy-shop", publication_state: "deleted" }]);
assert.equal(await repository.archive({ managedShopId: "11111111-1111-4111-8111-111111111111", expectedRevision: 3, actorLabel: "operator" }), "ok");
assert.equal(await repository.restoreArchiveToUnlisted({ managedShopId: "11111111-1111-4111-8111-111111111111", expectedRevision: 3, actorLabel: "operator" }), "ok");
assert.equal(calls[6].init.cache, "force-cache", "repeated published directory reads must remain cacheable");
assert.equal(calls[7].init.cache, "force-cache", "unlisted directory reads must remain cacheable inside Next use-cache boundaries");
assert.equal(calls[8].init.cache, "no-store", "operator listing-state reads must not share a public cache");
assert.equal(calls[9].init.cache, "no-store", "archive writes must stay uncached");
assert.equal(calls[10].init.cache, "no-store", "archive restore writes must stay uncached");

console.log("managed-shop directory repository: PASS");
