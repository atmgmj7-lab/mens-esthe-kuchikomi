import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const source = readFileSync(join(root, "lib/wp/areas.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

const target = { id: 13, slug: "target-area", name: "対象", parent: 0, count: 0, description: "", acf: {} };
const multiAreaLegacy = { id: 1, slug: "multi-area", areaSlug: "other-area", terms: [{ id: 13, slug: "target-area" }] };
const movedOutLegacy = { id: 2, slug: "moved-out", areaSlug: "target-area", terms: [{ id: 13, slug: "target-area" }] };
const movedInLegacy = { id: 3, slug: "moved-in", areaSlug: "other-area", terms: [{ id: 99, slug: "other-area" }] };
const movedOut = { existing_wp_shop_id: 2, shop_slug: "moved-out", area_slug: "other-area", directory_id: 1002 };
const movedIn = { existing_wp_shop_id: 3, shop_slug: "moved-in", area_slug: "target-area", directory_id: 1003 };
const targetNew = { existing_wp_shop_id: null, shop_slug: "target-new", area_slug: "target-area", directory_id: 1004 };
const helperCalls = [];

const module = { exports: {} };
vm.runInNewContext(output, {
  module,
  exports: module.exports,
  console,
  require: (id) => ({
    "@/lib/wp/client": { wpFetch: async (path) => String(path).startsWith("/wp/v2/area/13") ? target : [] },
    "next/cache": { cacheLife: () => undefined, cacheTag: () => undefined },
    "@/lib/wp/normalize": { normalizeShop: (shop) => shop },
    "@/lib/wp/build-resilience": { logWpBuildFallback: () => undefined },
    "@/lib/wp/area-shop-order": {
      getAreaShopOrderIndex: async () => [{ id: 1 }, { id: 2 }],
      fetchAreaShopsInOrder: async (_areaId, entries) => entries.map(({ id }) => id === 1 ? multiAreaLegacy : movedOutLegacy),
    },
    "@/lib/shop-management-source": { applyManagedShopFactsToList: async (shops) => shops, isManagedShopSourceUnavailableError: () => false },
    "@/lib/managed-shop-source": {
      composeManagedShopDirectory: async (shops) => shops,
      composeManagedShopPublicationsForArea: (areaSlug, legacy, movedInRows, publications, suppressions) => {
        helperCalls.push({ areaSlug, legacy, movedInRows, publications, suppressions });
        return [multiAreaLegacy, movedInLegacy, { id: targetNew.directory_id, slug: targetNew.shop_slug, areaSlug }];
      },
      getManagedShopDirectoryState: async () => ({ publications: [movedOut, movedIn, targetNew], suppressions: [] }),
      isManagedShopDirectoryUnavailableError: () => false,
    },
    "@/lib/supabase/managed-shop-directory": { useSupabaseManagedShopDirectory: () => true },
    "@/lib/wp/shops": {
      getAllWordPressShops: async () => [multiAreaLegacy, movedOutLegacy],
      getWordPressShopById: async (id) => id === 3 ? movedInLegacy : null,
    },
  }[id] ?? (() => { throw new Error(`Unexpected import: ${id}`); })()),
}, { filename: "lib/wp/areas.ts.cjs" });

const result = await module.exports.getAreaShops(13, 1, { perPage: 100 });
assert.deepEqual(Array.from(result.shops, (shop) => shop.id), [1, 3, 1004], "managed areas must preserve legacy taxonomy members and apply approved moves/new stores");
assert.equal(helperCalls.length, 1, "managed areas must use the taxonomy-preserving composition path");
assert.deepEqual(Array.from(helperCalls[0].legacy, (shop) => shop.id), [1, 2], "legacy area order must remain the WordPress taxonomy order");
assert.deepEqual(Array.from(helperCalls[0].movedInRows, (shop) => shop.id), [3], "only approved incoming legacy moves need an extra WordPress lookup");

const ranking = await module.exports.getAreaRankingShops(13);
assert.deepEqual(Array.from(ranking, (shop) => shop.id), [1, 3, 1004], "managed area rankings must use the same membership-preserving composition");
assert.equal(helperCalls.length, 2, "ranking data must not reintroduce the areaSlug-only filter");

console.log("managed area membership composition: PASS");
