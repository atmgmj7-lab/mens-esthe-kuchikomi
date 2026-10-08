import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const filename = join(root, "lib/shop-management-source.ts");
const output = ts.transpileModule(readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

const module = { exports: {} };
let reads = 0;
let snapshot = {
  wpShopId: 768, slug: "mrs-rank-up%ef%bc%88fixture%ef%bc%89", source: "supabase", revision: 2, updatedAt: "2026-10-08T00:00:00.000Z",
  values: { official_url: "https://managed.fixture.invalid/", basic_price: "13000", shop_hours: "11:00-01:00", shop_address: null, shop_tel: null, shop_line: null, shop_booking: null, shop_holiday: null, price_90: null, shop_booking_url: null },
};
vm.runInNewContext(output, {
  module,
  exports: module.exports,
  require: (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "@/lib/supabase/partner-shop-facts") return {
      useSupabaseShopManagement: () => true,
      partnerShopFactsRepository: {
        get: async () => {
          reads += 1;
          return snapshot;
        },
      },
    };
    throw new Error(`Unexpected dependency: ${specifier}`);
  },
});

const { applyManagedShopFacts, applyManagedShopFactsToList, ManagedShopSourceUnavailableError } = module.exports;
const shop = { id: 768, publicationStatus: "publish", slug: "mrs-rank-up%ef%bc%88fixture%ef%bc%89", officialUrl: "https://wordpress.fixture.invalid/", acf: { basic_price: 12000, shop_address: "WP address" } };
const managed = await applyManagedShopFacts(shop);
assert.equal(managed.officialUrl, "https://managed.fixture.invalid/");
assert.equal(managed.acf.basic_price, "13000");
assert.equal(managed.acf.shop_hours, "11:00-01:00");
assert.equal(managed.acf.shop_address, "WP address", "an unobserved null field must not erase the public projection");
const other = { ...shop, id: 769, slug: "other-shop" };
assert.deepEqual(JSON.parse(JSON.stringify(await applyManagedShopFacts(other))), other, "another shop must never receive WP768 facts");
assert.equal(reads, 1, "only the approved WP768 identity may query the private snapshot");
snapshot = null;
await assert.rejects(
  () => applyManagedShopFacts(shop),
  ManagedShopSourceUnavailableError,
  "a missing snapshot must become a temporary source error instead of a stale WP fallback or 404"
);
snapshot = { ...managed, slug: "wrong-shop", source: "supabase", revision: 2, updatedAt: "2026-10-08T00:00:00.000Z", values: { ...managed.acf } };
await assert.rejects(
  () => applyManagedShopFacts(shop),
  ManagedShopSourceUnavailableError,
  "an identity mismatch must become a temporary source error instead of a stale WP fallback or 404"
);
snapshot = {
  wpShopId: 768, slug: shop.slug, source: "supabase", revision: 2, updatedAt: "2026-10-08T00:00:00.000Z",
  values: { official_url: "https://managed.fixture.invalid/", basic_price: "13000", shop_hours: "11:00-01:00", shop_address: null, shop_tel: null, shop_line: null, shop_booking: null, shop_holiday: null, price_90: null, shop_booking_url: null },
};
const readsBeforeStopped = reads;
assert.equal(await applyManagedShopFacts({ ...shop, publicationStatus: "draft" }), null, "a non-public WP768 record must not be shown by the source switch");
assert.equal(reads, readsBeforeStopped, "a non-public WP768 record must not query private facts");
snapshot = null;
await assert.rejects(() => applyManagedShopFactsToList([shop]), ManagedShopSourceUnavailableError, "a source failure must not cache an empty list");

console.log("shop management source overlay: PASS");
