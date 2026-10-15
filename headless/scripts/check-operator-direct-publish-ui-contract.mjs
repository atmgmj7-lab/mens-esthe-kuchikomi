import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const forms = readFileSync(join(root, "components/dashboard/ManagedShopForms.tsx"), "utf8");
const shops = readFileSync(join(root, "components/dashboard/OperatorShops.tsx"), "utf8");

assert.match(forms, /action: "create_and_publish"/, "new operator shops must publish directly");
assert.match(forms, /action: "import_and_publish"/, "legacy operator shops must enter direct publication management");
assert.match(forms, /action: "save_and_publish"/, "operator edits must save and publish directly");
assert.match(forms, /action: "unlist"/, "operator UI must provide reversible unlisting");
assert.match(forms, /action: "restore"/, "operator UI must provide restoration");
assert.match(forms, /confirmedShopName/, "unlisting UI must send exact-name confirmation");
assert.match(forms, /店舗名を正確に入力/, "unlisting UI must explain exact-name confirmation");
assert.doesNotMatch(forms, /審査へ提出する|承認して公開する|差し戻す（理由必須）/, "operator editor must not expose an approval workflow");
assert.match(shops, /UnlistLegacyShopButton/, "dashboard listing must expose a clear unlist entrance");
assert.match(shops, /掲載を停止する/, "dashboard must label reversible removal clearly");

console.log("operator direct-publish UI contract: PASS");
