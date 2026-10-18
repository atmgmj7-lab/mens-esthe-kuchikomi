import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/dashboard/ManagedShopForms.tsx", import.meta.url), "utf8");

assert.match(source, /action:\s*"review"/, "a submitted canonical Partner revision must be sent through the canonical review action");
assert.match(source, /承認して公開/, "the operator UI must expose explicit approval for a submitted Partner revision");
assert.match(source, /差し戻し/, "the operator UI must expose a changes-requested path for a submitted Partner revision");

console.log("partner canonical review UI contract: PASS");
