import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const widgetPath = join(root, "lib/partner/partner-review-widget.ts");

function load(source, filename) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, URL, require: () => { throw new Error("unexpected dependency"); } });
  return module.exports;
}

const widget = existsSync(widgetPath) ? load(readFileSync(widgetPath, "utf8"), widgetPath) : {};
assert.equal(typeof widget.resolvePublicPartnerWidget, "function", "03D must expose a projection that can render only an eligible, public Partner widget");

const token = "11111111-1111-4111-8111-111111111111";
const source = {
  shopId: 101,
  shopSlug: "shop-a",
  shopName: "Partner Shop A",
  canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
  reviewUrl: `https://mens-esthe-kuchikomi.com/r/${token}/`,
  widgetUrl: `https://mens-esthe-kuchikomi.com/partner/widget/${token}/`,
  reviewCount: 3,
  averageRating: 4.2,
};

assert.deepEqual(JSON.parse(JSON.stringify(widget.resolvePublicPartnerWidget(source))), {
  status: "available",
  badge: "Eskomi Official Partner",
  shopName: "Partner Shop A",
  reviewSummary: { kind: "average_and_count", average: 4.2, count: 3 },
  reviewUrl: `https://mens-esthe-kuchikomi.com/r/${token}/`,
  iframeSnippet: `<iframe src="https://mens-esthe-kuchikomi.com/partner/widget/${token}/" title="Partner Shop AのEskomi口コミ" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
}, "an approved Partner widget must expose only its badge, contract-eligible aggregate, and canonical shop_website CTA");

assert.deepEqual(JSON.parse(JSON.stringify(widget.resolvePublicPartnerWidget({ ...source, reviewCount: 2, averageRating: 4.9 }))), {
  status: "available",
  badge: "Eskomi Official Partner",
  shopName: "Partner Shop A",
  reviewSummary: { kind: "count_only", count: 2 },
  reviewUrl: `https://mens-esthe-kuchikomi.com/r/${token}/`,
  iframeSnippet: `<iframe src="https://mens-esthe-kuchikomi.com/partner/widget/${token}/" title="Partner Shop AのEskomi口コミ" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
}, "fewer than three valid ratings must display count only, never an average");

assert.deepEqual(JSON.parse(JSON.stringify(widget.resolvePublicPartnerWidget({ ...source, averageRating: null }))), {
  status: "available",
  badge: "Eskomi Official Partner",
  shopName: "Partner Shop A",
  reviewSummary: { kind: "count_only", count: 3 },
  reviewUrl: `https://mens-esthe-kuchikomi.com/r/${token}/`,
  iframeSnippet: `<iframe src="https://mens-esthe-kuchikomi.com/partner/widget/${token}/" title="Partner Shop AのEskomi口コミ" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
}, "an unavailable aggregate must not be fabricated from a review count");

for (const unsafe of [
  { ...source, shopName: "<script>alert(1)</script>" },
  { ...source, reviewUrl: "https://example.invalid/r/token/" },
  { ...source, widgetUrl: "https://example.invalid/widget/" },
  { ...source, reviewCount: -1 },
]) {
  assert.deepEqual(JSON.parse(JSON.stringify(widget.resolvePublicPartnerWidget(unsafe))), { status: "unavailable" }, "unsafe or malformed widget data must fail closed");
}

console.log("partner review widget contract: PASS");
