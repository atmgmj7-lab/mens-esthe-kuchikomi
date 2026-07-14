import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const modulePath = join(root, "lib/content-source/config.ts");
assert.ok(existsSync(modulePath), "Content source config module must exist");

const source = readFileSync(modulePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(
  compiled,
  { module, exports: module.exports, process: { env: {} } },
  { filename: "content-source-config.cjs" }
);

const { resolveContentReadPlan } = module.exports;
const configured = {
  SUPABASE_CONTENT_URL: "https://project.supabase.co",
  SUPABASE_CONTENT_PUBLISHABLE_KEY: "publishable-test-key"
};

assert.equal(
  JSON.stringify(resolveContentReadPlan({})),
  JSON.stringify({
    mode: "wordpress",
    primary: "wordpress",
    comparison: null,
    supabaseConfigured: false,
    cutoverApproved: false
  })
);
assert.equal(resolveContentReadPlan({ CONTENT_DATA_SOURCE: "wordpress" }).primary, "wordpress");

const shadow = resolveContentReadPlan({ ...configured, CONTENT_DATA_SOURCE: "shadow" });
assert.equal(shadow.primary, "wordpress");
assert.equal(shadow.comparison, "supabase");
assert.equal(shadow.supabaseConfigured, true);

assert.throws(
  () => resolveContentReadPlan({ CONTENT_DATA_SOURCE: "shadow" }),
  /shadow.*SUPABASE_CONTENT_URL.*SUPABASE_CONTENT_PUBLISHABLE_KEY/i
);
assert.throws(
  () => resolveContentReadPlan({ ...configured, CONTENT_DATA_SOURCE: "supabase" }),
  /SUPABASE_CONTENT_CUTOVER_APPROVED=true/i
);

const cutover = resolveContentReadPlan({
  ...configured,
  CONTENT_DATA_SOURCE: "supabase",
  SUPABASE_CONTENT_CUTOVER_APPROVED: "true"
});
assert.equal(cutover.primary, "supabase");
assert.equal(cutover.comparison, "wordpress");
assert.equal(cutover.cutoverApproved, true);

assert.throws(
  () => resolveContentReadPlan({ CONTENT_DATA_SOURCE: "invalid" }),
  /Unsupported CONTENT_DATA_SOURCE/i
);

console.log("Content source config checks passed.");
