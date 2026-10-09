import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const helperPath = resolve(root, "lib/reviews/rankup-native-review-public-cache.ts");
const routePath = resolve(root, "app/api/dashboard/reviews/moderation/route.ts");
const helperSource = readFileSync(helperPath, "utf8");
const routeSource = readFileSync(routePath, "utf8");

assert.match(routeSource, /input\.action === "published" && useRankUpNativeReviewPilot\(process\.env\)/);
assert.match(routeSource, /detail\.data\.shop\.wpShopId === RANK_UP_WP_SHOP_ID/);
assert.match(routeSource, /revalidateRankUpNativeReviewPublicCaches\(detail\.data\.shop\.slug/);
assert.doesNotMatch(routeSource, /input\.action === "approved"[\s\S]{0,300}revalidateRankUpNativeReviewPublicCaches/);

const output = ts.transpileModule(helperSource, {
  fileName: helperPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", output)(() => {
  throw new Error("review cache helper must not import runtime dependencies");
}, loaded, loaded.exports);

const calls = [];
loaded.exports.revalidateRankUpNativeReviewPublicCaches("mrs-rank-up%ef%bc%88fixture%ef%bc%89", {
  revalidatePath: (...args) => calls.push(args),
});
assert.deepEqual(calls, [
  ["/shops/mrs-rank-up%ef%bc%88fixture%ef%bc%89"],
  ["/shops/mrs-rank-up%ef%bc%88fixture%ef%bc%89/reviews"],
  ["/"],
  ["/reviews"],
  ["/area/[slug]", "page"],
]);

console.log("Mrs.Rank UP native review public cache contract: PASS");
