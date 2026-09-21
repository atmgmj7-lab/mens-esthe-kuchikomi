import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const path = join(root, "lib/reviews/low-friction-review.ts");
function load(source) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: () => ({}) });
  return module.exports;
}
const review = existsSync(path) ? load(readFileSync(path, "utf8")) : {};
assert.equal(typeof review.prepareReviewConfirmation, "function", "03E must prepare an explicit, user-controlled confirmation without relaxing the final Native Review body contract");
assert.match(readFileSync(join(root, "lib/review-validation.ts"), "utf8"), /import \{ REVIEW_TAGS \}/, "the Native submission validator must use the same canonical UI tag set");

const valid = review.prepareReviewConfirmation({
  ratingTotal: 1,
  tags: ["wait_concern", "price_unclear"],
  note: "予約時の案内と実際の料金に差があり、待ち時間も長く感じました。改善されると安心です。",
});
assert.deepEqual(JSON.parse(JSON.stringify(valid)), {
  status: "ready",
  body: "予約時の案内と実際の料金に差があり、待ち時間も長く感じました。改善されると安心です。",
  tags: ["wait_concern", "price_unclear"],
}, "negative ratings and concern tags must remain intact through confirmation");

assert.deepEqual(JSON.parse(JSON.stringify(review.prepareReviewConfirmation({
  ratingTotal: 5, tags: ["clean", "clean"], note: "これは十分に長い口コミ本文ですが、重複タグは不正です。あくまでテスト用の文章です。",
}))), { status: "invalid", reason: "tags" }, "duplicate tags must be rejected instead of silently changing the user selection");
assert.deepEqual(JSON.parse(JSON.stringify(review.prepareReviewConfirmation({
  ratingTotal: 3, tags: [], note: "短い感想",
}))), { status: "needs_note" }, "an optional initial note may be short, but final submission must ask for a Native-contract-compatible note");
assert.deepEqual(JSON.parse(JSON.stringify(review.prepareReviewConfirmation({
  ratingTotal: 3, tags: ["staff_polite", "clean", "booking_smooth", "price_clear", "beginner_friendly", "want_revisit", "wait_concern"], note: "これは十分に長い口コミ本文ですが、タグ数が多すぎることを確認するための文章です。",
}))), { status: "invalid", reason: "tags" }, "the stable tag set must be capped at six");
console.log("low-friction review confirmation contract: PASS");
