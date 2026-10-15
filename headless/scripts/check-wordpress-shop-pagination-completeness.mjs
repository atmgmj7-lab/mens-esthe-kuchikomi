import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourcePath = join(root, "lib/wp/shops.ts");
assert.ok(existsSync(sourcePath), "shop reader must exist");

const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const loaded = { exports: {} };
let paginatedReader = async () => { throw new Error("unexpected default reader"); };
let directoryState = { publications: [], suppressions: [] };
vm.runInNewContext(compiled, {
  module: loaded,
  exports: loaded.exports,
  require: (id) => ({
    crypto: { createHash: () => ({ update: () => ({ digest: () => "fixture" }) }) },
    "@/lib/wp/client": { wpFetch: async () => [], wpFetchPaginated: (path) => paginatedReader(path) },
    "next/cache": { cacheLife: () => undefined, cacheTag: () => undefined },
    "@/lib/wp/normalize": { normalizeShop: (shop) => shop },
    "@/lib/wp/build-resilience": { logWpBuildFallback: () => undefined },
    "@/lib/shop-management-source": { applyManagedShopFactsToList: async (shops) => shops, isManagedShopSourceUnavailableError: () => false },
    "@/lib/managed-shop-source": {
      composeManagedShopDirectory: async (shops) => shops,
      findPublishedManagedShopBySlug: async () => null,
      getManagedShopDirectoryState: async () => directoryState,
      isManagedShopDirectoryUnavailableError: () => false,
      isManagedShopLegacySuppressedBySlug: async () => false,
    },
  }[id] ?? (() => { throw new Error(`Unexpected require: ${id}`); })()),
  console,
}, { filename: "lib/wp/shops.ts.cjs" });

const { fetchCompleteWordPressShopList, getShopsForSitemap } = loaded.exports;
assert.equal(typeof fetchCompleteWordPressShopList, "function", "shop enumeration must expose the completeness guard");
assert.equal(typeof getShopsForSitemap, "function", "sitemap reader must be available");

const page = (ids, total = 200) => ({
  data: ids.map((id) => ({ id })),
  pagination: { total, totalPages: Math.ceil(total / 100) },
});

let attempts = 0;
const recovered = await fetchCompleteWordPressShopList(async (path) => {
  const currentPage = Number(new URL(`https://example.test${path}`).searchParams.get("page"));
  if (currentPage === 1) {
    attempts += 1;
    return page(Array.from({ length: 100 }, (_, index) => index + 1));
  }
  if (attempts === 1) throw new Error("transient page 2 failure");
  return page(Array.from({ length: 100 }, (_, index) => index + 101));
});
assert.equal(attempts, 2, "a failed enumeration must restart from page 1");
assert.equal(recovered.length, 200, "a recovered enumeration must include every expected row");

await assert.rejects(
  fetchCompleteWordPressShopList(async (path) => {
    const currentPage = Number(new URL(`https://example.test${path}`).searchParams.get("page"));
    if (currentPage === 1) return page(Array.from({ length: 100 }, (_, index) => index + 1));
    throw new Error("persistent page 2 failure");
  }),
  /complete WordPress shop list/i,
  "persistent pagination failure must never return a partial listing",
);

await assert.rejects(
  fetchCompleteWordPressShopList(async () => page(Array.from({ length: 99 }, (_, index) => index + 1))),
  /incomplete WordPress shop page/i,
  "short pages must be rejected instead of being rendered as a smaller public directory",
);

const sitemapPaths = [];
paginatedReader = async (path) => {
  sitemapPaths.push(path);
  return {
    data: [{ id: 1272, slug: "%e3%81%af%e3%81%aa%e3%81%ae%e6%b9%af", modified: "2026-10-15T00:00:00" }],
    pagination: { total: 1, totalPages: 1 },
  };
};
directoryState = {
  publications: [],
  suppressions: [{ existing_wp_shop_id: 1272, shop_slug: "%e3%81%af%e3%81%aa%e3%81%ae%e6%b9%af" }],
};
assert.equal(JSON.stringify(await getShopsForSitemap()), "[]", "an unlisted legacy shop must be removed from the sitemap");
const sitemapRequest = new URL(`https://example.test${sitemapPaths.at(-1)}`);
assert.equal(sitemapRequest.searchParams.get("_fields"), "id,slug,modified", "sitemap entries must request the legacy WordPress id used by the unlisting suppression");

console.log("WordPress shop pagination completeness: PASS");
