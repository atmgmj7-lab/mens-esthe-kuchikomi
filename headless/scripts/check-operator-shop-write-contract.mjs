import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const filename = join(root, "lib/dashboard/operator-shop-write-contract.ts");
const output = ts.transpileModule(readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports, URL });

const { createListingExclusionIntent, createOperatorShopWriteIntent } = module.exports;
const draft = {
  title: "  Operator Shop  ", area: "  大阪  ", officialUrl: "https://example.test/", address: "", businessHours: "", phone: "",
  lineUrl: "", bookingUrl: "https://example.test/book/", basicPrice: "", publicationState: "draft",
};

const create = createOperatorShopWriteIntent("create", draft, null);
assert.equal(create.writerStatus, "WORDPRESS_WRITER_MAPPING_REQUIRED");
assert.equal(create.wpShopId, null);
assert.equal(create.draft.title, "Operator Shop");
assert.equal(create.draft.area, "大阪");
assert.equal(createOperatorShopWriteIntent("update", draft, null).message, "更新対象のWordPress店舗IDを確認してください。");
assert.match(createOperatorShopWriteIntent("create", { ...draft, officialUrl: "javascript:alert(1)" }, null).message, /URL/);

const exclusion = createListingExclusionIntent(768, "identity_mismatch");
assert.deepEqual(JSON.parse(JSON.stringify(exclusion)), {
  kind: "listing_exclusion", wpShopId: 768, draft: null, exclusionReason: "identity_mismatch", writerStatus: "WORDPRESS_WRITER_MAPPING_REQUIRED",
});
assert.equal(createListingExclusionIntent(768, "delete").message, "掲載対象外の理由を選択してください。");

console.log("operator shop write contract: PASS");
