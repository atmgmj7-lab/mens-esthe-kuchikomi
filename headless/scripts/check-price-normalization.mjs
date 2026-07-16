import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "lib/price-normalization.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  }
}).outputText;

const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, console }, { filename: "price-normalization.cjs" });

const {
  normalizePrice,
  getMinimumConfirmedPrice,
  formatPriceForDisplay,
  shouldOutputPriceSchema,
  resolveShopPrimaryPrice,
  resolveShopCoursePrices
} = module.exports;

const cases = [
  [null, "primary-course", "unknown", null],
  ["", "primary-course", "unknown", null],
  [" ", "primary-course", "unknown", null],
  [0, "primary-course", "unknown", null],
  ["0", "primary-course", "unknown", null],
  ["0円", "primary-course", "unknown", null],
  ["無料", "primary-course", "unknown", null],
  ["12,000", "primary-course", "confirmed", 12000],
  ["12,000円", "primary-course", "confirmed", 12000],
  [12000, "primary-course", "confirmed", 12000],
  [-1000, "primary-course", "invalid", null],
  ["未確認", "primary-course", "unknown", null],
  ["お問い合わせ", "primary-course", "unknown", null],
  ["無料", "nomination-fee", "free", 0],
  [0, "nomination-fee", "unknown", null],
  [Number.NaN, "primary-course", "invalid", null],
  ["１２，０００円", "primary-course", "confirmed", 12000],
  ["応相談", "primary-course", "unknown", null],
  ["FREE", "option-fee", "free", 0]
];

for (const [input, context, expectedStatus, expectedAmount] of cases) {
  const actual = normalizePrice(input, context);
  assert.equal(actual.status, expectedStatus, `${String(input)} status`);
  assert.equal(actual.amount, expectedAmount, `${String(input)} amount`);
}

const mixedMinimum = getMinimumConfirmedPrice(["", "0", "未確認", "13,000円", "12,000円"], "primary-course");
assert.equal(mixedMinimum.status, "confirmed");
assert.equal(mixedMinimum.amount, 12000);
assert.equal(formatPriceForDisplay(mixedMinimum, "〜"), "12,000円〜");
assert.equal(shouldOutputPriceSchema(mixedMinimum), true);

const unknownMinimum = getMinimumConfirmedPrice(["", "0", "未確認"], "primary-course");
assert.equal(unknownMinimum.status, "unknown");
assert.equal(unknownMinimum.amount, null);
assert.equal(formatPriceForDisplay(unknownMinimum, "〜"), null);
assert.equal(shouldOutputPriceSchema(unknownMinimum), false);

const arrayPrice = normalizePrice(["", "0円", "15,000円"], "primary-course");
assert.equal(arrayPrice.status, "confirmed");
assert.equal(arrayPrice.amount, 15000);

const shopPrimary = resolveShopPrimaryPrice({ shop_price_60min: "", price_60: "0", price_90: "14,000円" });
assert.equal(shopPrimary.status, "confirmed");
assert.equal(shopPrimary.amount, 14000);

const coursePrices = resolveShopCoursePrices({ price_50: "", price_60: "0円", price_90: "12,000円" });
assert.equal(coursePrices.length, 1);
assert.equal(coursePrices[0].label, "90分");
assert.equal(coursePrices[0].price.amount, 12000);

const shopDetailViewModelSource = readFileSync(join(root, "lib/shop-detail-view-model.ts"), "utf8");
assert.ok(!shopDetailViewModelSource.includes("?? 12000"));
for (const inventedValue of ["12,000", "不定休", "完全予約制", "駐車場なし", "0名", "OPEN"]) {
  assert.ok(
    !shopDetailViewModelSource.includes(inventedValue),
    `ShopDetailViewModel must not contain invented fallback value: ${inventedValue}`
  );
}

const shopDetailSource = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
assert.ok(!shopDetailSource.includes('Number(field(shop, "shop_price_60min")'), "ShopDetail must not Number() primary price fields");
assert.ok(!shopDetailSource.includes("Number(value).toLocaleString"), "ShopDetail must not Number() course prices for display");

const shopCardSource = readFileSync(join(root, "components/ShopCard.tsx"), "utf8");
assert.ok(!shopCardSource.includes("¥${yen.toLocaleString"), "ShopCard must not build yen display from raw 0 sentinel");

const seoSource = readFileSync(join(root, "lib/seo.ts"), "utf8");
assert.ok(seoSource.includes("shouldOutputPriceSchema"), "LocalBusiness JSON-LD must guard price schema output");

console.log("Price normalization check passed.");
