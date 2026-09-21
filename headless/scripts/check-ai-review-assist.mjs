import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const path = join(root, "lib/reviews/ai-review-assist.ts");
const routePath = join(root, "app/api/reviews/ai-assist/route.ts");
function load(source) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: (id) => id === "server-only" ? {} : {} });
  return module.exports;
}
const assist = existsSync(path) ? load(readFileSync(path, "utf8")) : {};
const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";
assert.equal(typeof assist.prefilterAiReviewInput, "function", "03F must deterministically classify or redact unsafe Review input before any provider call");
assert.equal(typeof assist.parseAiReviewOutput, "function", "03F must accept only structured AI decisions and a bounded draft");
assert.equal(assist.resolveAiReviewModel({}), "gemini-3.1-flash-lite", "Review Assist must default to the selected stable model available to the production key");
assert.equal(assist.estimateAiReviewCostUsd(1_000_000, 0), 0.25, "standard input telemetry must use Gemini 3.1 Flash-Lite pricing");
assert.equal(assist.estimateAiReviewCostUsd(0, 1_000_000), 1.5, "standard output telemetry must use Gemini 3.1 Flash-Lite pricing");
assert.equal(assist.estimateAiReviewCostUsd(1_000_000, 0, "batch"), 0.125, "batch input telemetry must use Gemini 3.1 Flash-Lite pricing");
assert.equal(assist.estimateAiReviewCostUsd(0, 1_000_000, "batch"), 0.75, "batch output telemetry must use Gemini 3.1 Flash-Lite pricing");
assert.equal(typeof assist.listAvailableGeminiTextModels, "function", "production model selection must verify the key's available Gemini text models");
const listedModels = await assist.listAvailableGeminiTextModels(
  { GEMINI_API_KEY: "fixture-key" },
  async () => ({
    ok: true,
    json: async () => ({ models: [
      { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.1-flash-lite-preview", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
    ] }),
  }),
);
assert.deepEqual(JSON.parse(JSON.stringify(listedModels)), ["gemini-2.5-flash", "gemini-3.1-flash-lite"], "only available stable generateContent models may be considered");
const transportFailureProvider = assist.createGeminiReviewProvider(
  { GEMINI_API_KEY: "fixture-key" },
  async () => { throw new DOMException("timed out", "AbortError"); },
);
assert.equal(await transportFailureProvider.generate({ ratingTotal: 3, tags: [], note: "安全なテスト本文です。" }, new AbortController().signal), null, "provider transport failures must fail closed without exposing the API key");
const invalidJsonProvider = assist.createGeminiReviewProvider(
  { GEMINI_API_KEY: "fixture-key" },
  async () => ({ ok: true, json: async () => { throw new SyntaxError("invalid provider response"); } }),
);
assert.equal(await invalidJsonProvider.generate({ ratingTotal: 3, tags: [], note: "安全なテスト本文です。" }, new AbortController().signal), null, "provider response parsing failures must fail closed without exposing response content");
assert.match(readFileSync(path, "utf8"), /review_ai_provider_response[\s\S]*response\.status/u, "provider failures must log only model/status metadata for production diagnosis");
assert.match(routeSource, /review_ai_unavailable/u, "route failures must log a safe availability stage for production diagnosis");
assert.match(routeSource, /result\.status === "error"[\s\S]*result\.error\.code/u, "rate-limit diagnostics must record only the repository error category");

assert.deepEqual(JSON.parse(JSON.stringify(assist.prefilterAiReviewInput({
  ratingTotal: 1, tags: ["wait_concern"], note: "連絡が遅く、待ち時間が長く感じました。",
}))), { status: "safe", note: "連絡が遅く、待ち時間が長く感じました。" }, "negative sentiment must remain eligible and not be converted to praise");
assert.deepEqual(JSON.parse(JSON.stringify(assist.prefilterAiReviewInput({
  ratingTotal: 3, tags: [], note: "連絡先は test@example.com と 090-1234-5678 です。",
}))), { status: "human_review", note: "連絡先は [連絡先を削除] と [連絡先を削除] です。" }, "obvious PII must be redacted deterministically and routed to human review");
assert.equal(assist.prefilterAiReviewInput({ ratingTotal: 3, tags: [], note: "LINE ID: review_user_01" }).status, "human_review", "contact handles are never sent to Gemini");
assert.equal(assist.prefilterAiReviewInput({ ratingTotal: 3, tags: [], note: "www.example.com を見てください" }).status, "human_review", "bare web addresses are never sent to Gemini");
assert.deepEqual(JSON.parse(JSON.stringify(assist.prefilterAiReviewInput({
  ratingTotal: 3, tags: [], note: "殺す。",
}))), { status: "human_review", note: "殺す。" }, "threats must never be delegated to automatic rewriting");
assert.deepEqual(JSON.parse(JSON.stringify(assist.parseAiReviewOutput({ decision: "REWRITE_SAFE", draft: "読みやすく整えた文章です。" }))), {
  decision: "REWRITE_SAFE", draft: "読みやすく整えた文章です。",
}, "a valid structured provider output may contain only the approved decision and bounded draft");
assert.equal(assist.parseAiReviewOutput({ decision: "SAFE", ratingTotal: 5 }), null, "AI output must reject rating/tag mutation fields");
assert.equal(assist.parseAiReviewOutput({ decision: "PROMOTE", draft: "最高" }), null, "unknown decisions must fail closed");
console.log("AI Review Assist deterministic contract: PASS");
