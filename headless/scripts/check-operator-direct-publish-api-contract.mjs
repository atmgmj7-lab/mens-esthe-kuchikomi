import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const operatorRoute = readFileSync(join(root, "app/api/dashboard/managed-shops/route.ts"), "utf8");
const partnerRoute = readFileSync(join(root, "app/api/partner/listing/route.ts"), "utf8");

for (const action of ["create_and_publish", "import_and_publish", "save_and_publish", "unlist", "restore"]) {
  assert.match(operatorRoute, new RegExp(`body\\.action === ["']${action}["']`), `dashboard route must handle ${action}`);
}
assert.match(operatorRoute, /confirmedShopName/, "unlist must require an exact store-name confirmation");
assert.doesNotMatch(operatorRoute, /body\.action === ["']visibility["']/, "legacy visibility action would bypass confirmed unlisting");
assert.match(operatorRoute, /authorizeDashboardRequest/, "direct publication must stay inside the dashboard authorization boundary");
assert.match(operatorRoute, /result === "conflict"/, "direct publication must surface stale-write conflicts");
for (const rpc of ["createAndPublish", "importAndPublishLegacy", "saveAndPublish"]) {
  assert.match(operatorRoute, new RegExp(`managedShopDirectoryRepository\\.${rpc}`), `dashboard route must use ${rpc}`);
}

assert.match(partnerRoute, /authorizePartnerSession/, "Partner listing remains bound to its own workspace session");
assert.doesNotMatch(partnerRoute, /create_and_publish_managed_shop|import_and_publish_managed_shop_from_legacy|save_and_publish_managed_shop|managedShopDirectoryRepository/, "Partner route must not access operator direct-publication APIs");

console.log("operator direct-publish API contract: PASS");
