import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const slugSource = readFileSync(join(root, "lib/shop-slug.ts"), "utf8");
const slugCompiled = ts.transpileModule(slugSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const slugModule = { exports: {} };
vm.runInNewContext(slugCompiled, {
  module: slugModule,
  exports: slugModule.exports,
  decodeURIComponent,
  encodeURIComponent,
});

const routeParamSource = readFileSync(join(root, "lib/shop-route-param.ts"), "utf8");
const routeParamCompiled = ts.transpileModule(routeParamSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routeParamModule = { exports: {} };
vm.runInNewContext(routeParamCompiled, {
  module: routeParamModule,
  exports: routeParamModule.exports,
  decodeURIComponent,
  require: (specifier) => {
    if (specifier === "@/lib/shop-slug") return slugModule.exports;
    throw new Error(`Unexpected shop route dependency: ${specifier}`);
  },
});

const { toShopRouteParam } = routeParamModule.exports;
const encodedSlug =
  "c-rest%ef%bc%88%e3%82%b7%e3%83%bc%e3%83%ac%e3%82%b9%e3%83%88%ef%bc%89";
assert.equal(toShopRouteParam("betty-spa"), "betty-spa");
assert.equal(toShopRouteParam(encodedSlug), "c-rest（シーレスト）");
assert.equal(toShopRouteParam("bad%2fslug"), "");
assert.equal(toShopRouteParam("%e3%81"), "");

const pageSource = readFileSync(join(root, "app/shops/[slug]/page.tsx"), "utf8");
assert.match(pageSource, /slug: toShopRouteParam\(shop\.slug\)/);
assert.doesNotMatch(pageSource, /slug: shop\.slug/);
assert.match(
  pageSource,
  /slug: "__wp-build-fallback__"/,
  "CI fallback must remain a non-public sentinel instead of a real non-ASCII shop slug",
);

const shopsSource = readFileSync(join(root, "lib/wp/shops.ts"), "utf8");
assert.match(shopsSource, /resolveLegacyShopSlugAlias/u, "the public directory reader must resolve an unambiguous legacy ASCII slug alias");
assert.match(shopsSource, /candidate\.startsWith\(`\$\{alias\}（`\)/u, "the alias must only match the canonical Japanese-suffix slug form");
assert.match(shopsSource, /legacyMatches/u, "the WordPress fallback must search the complete listing for a legacy slug alias");
assert.match(shopsSource, /legacyMatches\.length === 1/u, "an ambiguous legacy alias must never resolve to an arbitrary shop");
assert.match(pageSource, /function matchesCanonicalShopSlug/u, "detail routing must compare decoded canonical slugs before redirecting");
assert.match(pageSource, /decodeURIComponent\(canonicalSlug\)/u, "the canonical slug comparison must accept Next's decoded non-ASCII route parameter");
assert.match(pageSource, /permanentRedirect\(`\/shops\/\$\{encodeURIComponent\(toShopRouteParam\(shop\.slug\)\)\}\/`\)/u, "a legacy shop alias must redirect with an HTTP-safe encoded canonical URL");

console.log("shop route param check passed");
