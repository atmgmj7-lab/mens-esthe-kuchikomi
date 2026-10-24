import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "lib/contact-vercel-fallback.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "contact-vercel-fallback.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)((specifier) => {
  throw new Error(`Unexpected dependency: ${specifier}`);
}, loaded, loaded.exports);

const { resolveContactVercelFallback } = loaded.exports;
const approvedOrigin = "https://escomi-headless-narikiyos-projects.vercel.app";
const bypass = "fixture-protection-bypass";

assert.equal(
  resolveContactVercelFallback({}),
  null,
  "fallback must remain disabled without both explicit configuration values",
);
assert.equal(
  resolveContactVercelFallback({ CONTACT_VERCEL_FALLBACK_ORIGIN: approvedOrigin }),
  null,
  "a protected Vercel fallback must not be contacted without its bypass secret",
);
assert.equal(
  resolveContactVercelFallback({
    CONTACT_VERCEL_FALLBACK_ORIGIN: "https://mens-esthe-kuchikomi.com",
    CONTACT_VERCEL_PROTECTION_BYPASS: bypass,
  }),
  null,
  "the public hostname is never a fallback origin because a cutover would recurse",
);
assert.equal(
  resolveContactVercelFallback({
    CONTACT_VERCEL_FALLBACK_ORIGIN: "https://unapproved.example.test",
    CONTACT_VERCEL_PROTECTION_BYPASS: bypass,
  }),
  null,
  "an unapproved external origin must be rejected",
);
assert.equal(
  resolveContactVercelFallback({
    CONTACT_VERCEL_FALLBACK_ORIGIN: `${approvedOrigin}/unexpected-path`,
    CONTACT_VERCEL_PROTECTION_BYPASS: bypass,
  }),
  null,
  "the fallback origin cannot contain a path, query, credentials, or fragment",
);

const resolved = resolveContactVercelFallback({
  CONTACT_VERCEL_FALLBACK_ORIGIN: approvedOrigin,
  CONTACT_VERCEL_PROTECTION_BYPASS: bypass,
});
assert.equal(resolved?.url, `${approvedOrigin}/api/contact/`);
assert.equal(resolved?.headers.get("x-vercel-protection-bypass"), bypass);
assert.equal(resolved?.headers.get("content-type"), "application/json");
assert.equal(resolved?.headers.get("origin"), approvedOrigin);

console.log("Vercel contact fallback contract: PASS");
