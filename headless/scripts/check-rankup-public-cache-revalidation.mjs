import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const helperPath = resolve(root, "lib/dashboard/operator-shop-public-cache.ts");
const routePath = resolve(root, "app/api/dashboard/shops/[id]/official-facts/route.ts");

assert.ok(existsSync(helperPath), "managed-facts public cache helper must exist");
const helperSource = readFileSync(helperPath, "utf8");
const routeSource = readFileSync(routePath, "utf8");
assert.match(routeSource, /saved\.status === "saved"\) revalidateOfficialFactsPublicCaches\(saved\.snapshot\.slug\)/);
assert.doesNotMatch(routeSource, /saved\.status === "noop"\) revalidateOfficialFactsPublicCaches/);

const output = ts.transpileModule(helperSource, {
  fileName: helperPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", output)(() => {
  throw new Error("cache helper must not import runtime dependencies");
}, loaded, loaded.exports);

const calls = [];
loaded.exports.revalidateOperatorShopPublicCaches(
  "mrs-rank-up%ef%bc%88fixture%ef%bc%89",
  {
    revalidateTag: (...args) => calls.push(["tag", ...args]),
    revalidatePath: (...args) => calls.push(["path", ...args]),
  },
);
assert.deepEqual(calls, [
  ["tag", "wp", { expire: 0 }],
  ["path", "/shops/mrs-rank-up%ef%bc%88fixture%ef%bc%89"],
  ["path", "/sitemap.xml"],
]);

console.log("Mrs.Rank UP public cache revalidation contract: PASS");
