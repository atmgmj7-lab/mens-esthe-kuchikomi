import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const modulePath = join(root, "lib/dashboard/operator-shop-fact-dry-run.ts");
const source = readFileSync(modulePath, "utf8");
const output = ts.transpileModule(source, {
  fileName: modulePath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports });

const { OPERATOR_WRITER_FIELDS, createOperatorShopFactSnapshot, createOperatorShopFactDryRun } = module.exports;
assert.deepEqual(JSON.parse(JSON.stringify(OPERATOR_WRITER_FIELDS)), [
  "official_url", "basic_price", "shop_hours", "shop_address", "shop_tel", "shop_line", "shop_booking", "shop_holiday", "price_90", "shop_booking_url",
]);

const shop = {
  id: 768,
  slug: "mrs-rank-up",
  officialUrl: "https://mrs-rankup.example/",
  acf: {
    official_url: "https://mrs-rankup.example/",
    basic_price: 12000,
    shop_hours: "10:00〜翌2:00",
    shop_address: "大阪市北区",
    shop_tel: "06-0000-0000",
    shop_line: "https://line.example/mrs",
    shop_booking: "Web予約",
    shop_holiday: "不定休",
    price_90: "15000",
    shop_booking_url: "https://reserve.example/mrs",
  },
};
const baseline = createOperatorShopFactSnapshot(shop);
assert.equal(baseline.wpShopId, 768);
assert.equal(baseline.values.price_90, "15000", "readback snapshot must retain the source value exactly");

const input = Object.fromEntries(OPERATOR_WRITER_FIELDS.map((field) => [field, baseline.values[field] ?? ""]));
assert.equal(createOperatorShopFactDryRun(baseline, input).state, "noop", "unchanged fields must be a NOOP");

const changed = { ...input, shop_hours: "11:00〜翌1:00" };
const dryRun = createOperatorShopFactDryRun(baseline, changed);
assert.equal(dryRun.state, "ready");
assert.deepEqual(JSON.parse(JSON.stringify(dryRun.changes)), [{ field: "shop_hours", before: "10:00〜翌2:00", after: "11:00〜翌1:00" }], "only changed writer fields may enter a dry-run");

assert.equal(createOperatorShopFactDryRun(baseline, { ...input, shop_hours: "" }).state, "invalid", "an empty input must not erase an existing value");
const blankBaseline = createOperatorShopFactSnapshot({ ...shop, acf: { ...shop.acf, shop_holiday: "" } });
const blankInput = Object.fromEntries(OPERATOR_WRITER_FIELDS.map((field) => [field, blankBaseline.values[field] ?? ""]));
assert.equal(createOperatorShopFactDryRun(blankBaseline, blankInput).state, "noop", "an already-empty source field must not become a false change");
const zeroBaseline = createOperatorShopFactSnapshot({ ...shop, acf: { ...shop.acf, basic_price: 0 } });
const zeroInput = Object.fromEntries(OPERATOR_WRITER_FIELDS.map((field) => [field, zeroBaseline.values[field] ?? ""]));
assert.equal(createOperatorShopFactDryRun(zeroBaseline, zeroInput).state, "invalid", "the writer's non-positive price restriction must reject a zero-valued dry-run");
const changedSource = { ...shop, acf: { ...shop.acf, shop_hours: "another editor value" } };
assert.equal(createOperatorShopFactDryRun(baseline, changed, createOperatorShopFactSnapshot(changedSource)).state, "conflict", "a stale baseline must fail closed");
const readback = createOperatorShopFactSnapshot({ ...shop, acf: { ...shop.acf, shop_hours: changed.shop_hours } });
assert.equal(readback.values.shop_hours, changed.shop_hours, "fixture readback must reflect only the reviewed changed field");

const form = readFileSync(join(root, "components/dashboard/OperatorShopForms.tsx"), "utf8");
const editPage = readFileSync(join(root, "app/dashboard/shops/[id]/edit/page.tsx"), "utf8");
assert.match(form, /dry-run・書込みなし/);
assert.match(form, /disabled=\{!available\}/);
assert.match(form, /official-facts-write/, "the browser may only ask the server to check gated save conditions");
assert.match(form, /canonical・監査情報/, "browser input must not be treated as writer provenance");
assert.match(form, /Supabaseへ保存して再読込/);
assert.match(form, /response\.status === 409/, "a conflict response must replace the stale browser snapshot");
assert.match(editPage, /getOperatorShopFactSnapshot/);
assert.doesNotMatch(editPage, /publicationState|officialUrl:\s*record/, "the legacy partial edit projection must not be used");

console.log("operator shop fact dry-run fixture: PASS");
