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
vm.runInNewContext(compiled, {
  module: loaded,
  exports: loaded.exports,
  require: (id) => ({
    crypto: { createHash: () => ({ update: () => ({ digest: () => "fixture" }) }) },
    "@/lib/wp/client": { wpFetch: async () => [], wpFetchPaginated: async () => { throw new Error("unexpected default reader"); } },
    "next/cache": { cacheLife: () => undefined, cacheTag: () => undefined },
    "@/lib/wp/normalize": { normalizeShop: (shop) => shop },
    "@/lib/wp/build-resilience": { logWpBuildFallback: () => undefined },
    "@/lib/shop-management-source": { applyManagedShopFactsToList: async (shops) => shops, isManagedShopSourceUnavailableError: () => false },
    "@/lib/managed-shop-source": {
      composeManagedShopDirectory: async (shops) => shops,
      findPublishedManagedShopBySlug: async () => null,
      getManagedShopDirectoryState: async () => ({ publications: [], suppressions: [] }),
      isManagedShopDirectoryUnavailableError: () => false,
      isManagedShopLegacySuppressedBySlug: async () => false,
    },
  }[id] ?? (() => { throw new Error(`Unexpected require: ${id}`); })()),
  console,
}, { filename: "lib/wp/shops.ts.cjs" });

const { fetchCompleteWordPressShopList } = loaded.exports;
assert.equal(typeof fetchCompleteWordPressShopList, "function", "shop enumeration must expose the completeness guard");

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

console.log("WordPress shop pagination completeness: PASS");
