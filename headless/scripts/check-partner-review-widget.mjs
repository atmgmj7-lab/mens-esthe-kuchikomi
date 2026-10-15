import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const widgetPath = join(root, "lib/partner/partner-review-widget.ts");
const widgetPagePath = join(root, "app/partner/widget/[token]/page.tsx");

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

const approvedWidget = widget.resolvePublicPartnerWidget(source);
assert.equal(approvedWidget.status, "available");
assert.deepEqual(JSON.parse(JSON.stringify(approvedWidget.reviewSummary)), { kind: "average_and_count", average: 4.2, count: 3 });
assert.equal(approvedWidget.badge, "Eskomi Official Partner");
assert.equal(approvedWidget.reviewUrl, `https://mens-esthe-kuchikomi.com/r/${token}/`);
assert.match(approvedWidget.iframeSnippet, new RegExp(`<iframe src="https://mens-esthe-kuchikomi\\.com/partner/widget/${token}/"`));
assert.match(approvedWidget.iframeSnippet, /height:700px/);
assert.match(approvedWidget.iframeSnippet, /scrolling="auto"/);
assert.match(approvedWidget.iframeSnippet, /event\.origin!==expectedOrigin/);
assert.match(approvedWidget.iframeSnippet, /event\.source!==frame\.contentWindow/);
assert.match(approvedWidget.iframeSnippet, /data\.type!=="eskomi:review-widget:height"/);
assert.match(approvedWidget.iframeSnippet, /Number\.isInteger\(data\.height\)/);
assert.match(approvedWidget.iframeSnippet, /data\.height<240\|\|data\.height>1200/);
assert.doesNotMatch(approvedWidget.iframeSnippet, /innerHTML|data\.url/i);

const belowThresholdWidget = widget.resolvePublicPartnerWidget({ ...source, reviewCount: 2, averageRating: 4.9 });
assert.equal(belowThresholdWidget.status, "available");
assert.deepEqual(JSON.parse(JSON.stringify(belowThresholdWidget.reviewSummary)), { kind: "count_only", count: 2 }, "fewer than three valid ratings must display count only, never an average");
const missingAverageWidget = widget.resolvePublicPartnerWidget({ ...source, averageRating: null });
assert.equal(missingAverageWidget.status, "available");
assert.deepEqual(JSON.parse(JSON.stringify(missingAverageWidget.reviewSummary)), { kind: "count_only", count: 3 }, "an unavailable aggregate must not be fabricated from a review count");

for (const unsafe of [
  { ...source, shopName: "<script>alert(1)</script>" },
  { ...source, reviewUrl: "https://example.invalid/r/token/" },
  { ...source, widgetUrl: "https://example.invalid/widget/" },
  { ...source, reviewCount: -1 },
]) {
  assert.deepEqual(JSON.parse(JSON.stringify(widget.resolvePublicPartnerWidget(unsafe))), { status: "unavailable" }, "unsafe or malformed widget data must fail closed");
}

const widgetPage = readFileSync(widgetPagePath, "utf8");
assert.match(widgetPage, /getShopReviews\(shop, 1, 3\)/, "widget must read a bounded set of public reviews only");
assert.match(widgetPage, /公開済みの口コミはまだありません。/, "widget must show an honest empty state instead of fabricated reviews");
assert.match(widgetPage, /reviews\.page\.reviews\.map/, "widget must render only the public adapter review projection");
assert.match(widgetPage, /Eskomiで口コミをもっと見る/, "widget must link readers to the shop's public Eskomi page");
assert.match(widgetPage, /口コミを書く/, "widget must keep review writing separate from review reading");
assert.match(widgetPage, /Eskomiに寄せられた口コミ/, "widget must identify the independent review source");
assert.match(widgetPage, /出典：Eskomi/, "widget must label the review source without hidden links");
assert.match(widgetPage, /rel="nofollow noopener noreferrer"/, "widget links must not be an SEO link scheme");
assert.doesNotMatch(widgetPage, /nickname|email|moderationStatus|audit/i, "widget page must not render private reviewer or moderation fields");
assert.match(widgetPage, /ResizeObserver/, "widget must report its own bounded content height");
assert.match(widgetPage, /eskomi:review-widget:height/, "widget height reporter must expose only its typed height event");

console.log("partner review widget contract: PASS");
