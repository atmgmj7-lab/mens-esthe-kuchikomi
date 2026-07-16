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
assert.match(pageSource, /slug: "c-r-e-a-m（クリーム）"/);

console.log("shop route param check passed");
