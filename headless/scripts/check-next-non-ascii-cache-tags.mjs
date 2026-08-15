import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const shopSource = readFileSync(join(headlessRoot, "lib/wp/shops.ts"), "utf8");

function loadShopModule({ cacheTags, wpRequests }) {
  const result = ts.transpileModule(shopSource, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "lib/wp/shops.ts",
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, "the production shop adapter must transpile for the cache-tag fixture");

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "crypto") return { createHash };
    if (specifier === "@/lib/wp/client") {
      return {
        wpFetch: async (path) => {
          wpRequests.push(path);
          return [{ id: 1, slug: "fixture-shop" }];
        },
        wpFetchPaginated: async () => {
          throw new Error("the direct slug lookup must not require the listing fallback");
        },
      };
    }
    if (specifier === "next/cache") {
      return {
        cacheLife: () => undefined,
        cacheTag: (...tags) => cacheTags.push(tags),
      };
    }
    if (specifier === "@/lib/wp/normalize") return { normalizeShop: (shop) => shop };
    if (specifier === "@/lib/wp/build-resilience") return { logWpBuildFallback: () => undefined };
    throw new Error(`Unexpected shop adapter import: ${specifier}`);
  };
  new Function("require", "module", "exports", result.outputText)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

async function observeShopCacheTag(slug) {
  const cacheTags = [];
  const wpRequests = [];
  const { getShopBySlug } = loadShopModule({ cacheTags, wpRequests });

  await getShopBySlug(slug);

  assert.equal(cacheTags.length, 1, "a direct shop lookup must register one cache tag set");
  assert.equal(wpRequests.length, 1, "a matching direct slug lookup must not use fallback requests");
  return { tags: cacheTags[0], request: wpRequests[0] };
}

const cases = [
  {
    name: "decoded Japanese slug",
    slug: "日本語の店舗",
    expectedTag: "shop:h:7983502682736765",
  },
  {
    name: "percent-encoded Japanese slug",
    slug: "%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E5%BA%97%E8%88%97",
    expectedTag: "shop:h:7983502682736765",
  },
  {
    name: "long Japanese slug",
    slug: "非常に長い日本語店舗名".repeat(40),
    expectedTag: "shop:h:3d79ff3f9c15ad09",
  },
];

for (const testCase of cases) {
  const { tags, request } = await observeShopCacheTag(testCase.slug);
  const shopTag = tags[2];
  assert.deepEqual(tags, ["wp", "shops", testCase.expectedTag], `${testCase.name} must use the stable shop tag`);
  assert.match(
    shopTag,
    /^[a-zA-Z0-9:_-]{1,128}$/,
    `${testCase.name} must be safe for Eskomi revalidation and Next.js cache headers`,
  );
  assert.ok(shopTag.length <= 256, `${testCase.name} must satisfy the Next.js public tag limit`);
  assert.ok(request.startsWith("/wp/v2/shop?slug="), `${testCase.name} must use the production slug lookup`);
}

console.log("Eskomi non-ASCII shop cache tag contract: PASS");
