import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const file = join(root, "lib/partner/partner-login-return-to.ts");
const source = readFileSync(file, "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports, URL });
const { partnerLoginReturnTo, partnerLoginUrl } = module.exports;

assert.equal(partnerLoginReturnTo("/partner/growth/#growth-line-heading"), "/partner/growth/#growth-line-heading");
assert.equal(partnerLoginReturnTo("/partner/therapists/#partner-therapists-heading"), "/partner/therapists/#partner-therapists-heading");
for (const value of ["https://example.invalid/", "//example.invalid/", "/partner/growth/?next=https://example.invalid", "/partner/operations/#unknown", "/dashboard/"]) {
  assert.equal(partnerLoginReturnTo(value), "/partner/", `must reject non-allowlisted return target: ${value}`);
}
assert.equal(partnerLoginUrl("https://example.invalid/"), "/partner/login/?returnTo=%2Fpartner%2F", "login URL must never carry an external target");
const request = readFileSync(join(root, "app/api/partner/auth/request-link/route.ts"), "utf8");
const complete = readFileSync(join(root, "app/api/partner/auth/complete-link/route.ts"), "utf8");
const callback = readFileSync(join(root, "app/partner/auth/callback/page.tsx"), "utf8");
assert.match(request, /PARTNER_LOGIN_RETURN_TO_COOKIE/, "start must store the validated return target server-side");
assert.match(complete, /PARTNER_LOGIN_RETURN_TO_COOKIE/, "completion must consume and clear the server-side return target");
assert.match(callback, /partnerLoginReturnTo\(body\.returnTo\)/, "browser must revalidate the completion destination before navigation");
console.log("partner login return-to contract: PASS");
