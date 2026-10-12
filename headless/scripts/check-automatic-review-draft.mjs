import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "lib/reviews/automatic-review-draft.ts"), "utf8");
assert.doesNotMatch(source, /\bfetch\s*\(/, "automatic drafts must not initiate network communication");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", output)((specifier) => {
  if (specifier === "@/lib/reviews/low-friction-review") {
    return { REVIEW_TAGS: ["staff_polite", "clean", "booking_smooth", "price_clear", "beginner_friendly", "want_revisit", "wait_concern", "price_unclear", "guidance_unclear"] };
  }
  throw new Error(`Unexpected import: ${specifier}`);
}, module, module.exports);

const { createAutomaticReviewDraft } = module.exports;
assert.equal(typeof createAutomaticReviewDraft, "function");

assert.equal(createAutomaticReviewDraft({ tags: [] }), null, "unanswered selections must not invent a review");
assert.equal(createAutomaticReviewDraft({ ratingService: 5, ratingPrice: 3, ratingCleanliness: 1, tags: [] }), [
  "料金については普通と感じました。",
  "接客については良いと感じました。",
  "清潔感は気になる点がありました。",
].join("\n"), "positive, neutral, and concern choices must remain distinct");
assert.equal(createAutomaticReviewDraft({ tags: ["booking_smooth", "wait_concern", "unknown"] }), [
  "予約はスムーズでした。",
  "待ち時間が気になりました。",
].join("\n"), "only selected known experiences may appear in a draft");
assert.equal(createAutomaticReviewDraft({ ratingService: 4, tags: [] }).includes("また利用したい"), false, "a revisit wish must never be inferred from a rating");
assert.equal(createAutomaticReviewDraft({ ratingPrice: 9, tags: [] }), null, "out-of-range answers must not create content");
console.log("automatic review draft deterministic contract: PASS");
