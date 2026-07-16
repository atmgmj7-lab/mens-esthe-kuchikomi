import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const source = readFileSync(join(root, "lib/json-ld.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports });

const serialized = module.exports.serializeJsonLd({
  name: "</script><img src=x onerror=alert(1)>",
  ampersand: "A&B",
});
assert.equal(serialized.includes("<"), false, "JSON-LD must not contain an HTML script boundary");
assert.match(serialized, /\\u003c\/script>/);
assert.equal(JSON.parse(serialized).name, "</script><img src=x onerror=alert(1)>");

const shopDetailSource = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
assert.match(shopDetailSource, /serializeJsonLd\(shopSchema\)/);
assert.doesNotMatch(shopDetailSource, /JSON\.stringify\(shopSchema\)/);

console.log("JSON-LD serialization check passed");
