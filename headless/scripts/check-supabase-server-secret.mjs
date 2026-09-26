import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const resolverPath = join(root, "lib/supabase/server-secret.ts");

function loadResolver() {
  assert.equal(existsSync(resolverPath), true, "the server-only Supabase secret resolver must exist");
  const output = ts.transpileModule(readFileSync(resolverPath, "utf8"), {
    fileName: resolverPath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === "server-only") return {};
      throw new Error(`Unexpected dependency in ${resolverPath}: ${specifier}`);
    },
  });
  return module.exports;
}

const resolver = loadResolver();
const legacyJwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";
const modernSecret = "sb_secret_test_only_modern_key";

const modern = resolver.resolveSupabaseServerSecret({ SUPABASE_SECRET_KEY: modernSecret });
assert.deepEqual(
  JSON.parse(JSON.stringify(modern)),
  { value: modernSecret, source: "SUPABASE_SECRET_KEY", type: "MODERN_SECRET" },
  "a configured SUPABASE_SECRET_KEY must be selected as the canonical modern server secret",
);

const preferred = resolver.resolveSupabaseServerSecret({
  SUPABASE_SECRET_KEY: modernSecret,
  SUPABASE_SERVICE_ROLE_KEY: legacyJwt,
});
assert.equal(preferred?.value, modernSecret, "SUPABASE_SECRET_KEY must win when both variables exist");
assert.equal(preferred?.source, "SUPABASE_SECRET_KEY", "the selected source must remain auditable without exposing the value");

const modernHeaders = resolver.createSupabaseServerHeaders(modernSecret, {
  "Content-Type": "application/json",
  "Content-Profile": "api",
});
assert.equal(modernHeaders.apikey, modernSecret, "modern server requests must use the apikey header");
assert.equal(modernHeaders.Authorization, undefined, "modern server requests must never send an Authorization Bearer secret");

const legacy = resolver.resolveSupabaseServerSecret({ SUPABASE_SERVICE_ROLE_KEY: legacyJwt });
assert.deepEqual(
  JSON.parse(JSON.stringify(legacy)),
  { value: legacyJwt, source: "SUPABASE_SERVICE_ROLE_KEY", type: "LEGACY_JWT" },
  "a legacy value remains a temporary compatibility fallback only when the canonical modern variable is absent",
);
const legacyHeaders = resolver.createSupabaseServerHeaders(legacyJwt);
assert.equal(legacyHeaders.Authorization, `Bearer ${legacyJwt}`, "legacy JWT compatibility must be narrowly preserved");

const resolverSource = readFileSync(resolverPath, "utf8");
assert.match(resolverSource, /^import "server-only";/m, "the resolver must be server-only");
assert.doesNotMatch(resolverSource, /NEXT_PUBLIC_SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/, "server secrets must not have a public-variable path");

for (const relativePath of [
  "lib/partner/partner-auth-login-state.ts",
  "lib/partner/partner-auth-server.ts",
  "lib/partner/partner-login-email-service.ts",
  "lib/supabase/partner-workspace.ts",
  "lib/supabase/review-native.ts",
  "lib/supabase/shop-owner-request.ts",
  "lib/shop-owner-request-rate-limit.ts",
  "app/api/reviews/submit/route.ts",
  "app/api/reviews/ai-assist/route.ts",
]) {
  const source = readFileSync(join(root, relativePath), "utf8");
  assert.match(source, /resolveSupabaseServerSecret/, `${relativePath} must use the centralized server-secret resolver`);
  assert.doesNotMatch(source, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/, `${relativePath} must not read the legacy production variable directly`);
}

const p1OperatorSource = readFileSync(join(root, "scripts/p1-rank-auth-membership-operator.mjs"), "utf8");
assert.match(p1OperatorSource, /SUPABASE_SECRET_KEY/, "the P1 operator script must prefer the canonical modern secret variable");
assert.ok(
  p1OperatorSource.indexOf("SUPABASE_SECRET_KEY") < p1OperatorSource.indexOf("SUPABASE_SERVICE_ROLE_KEY"),
  "the P1 operator script must select SUPABASE_SECRET_KEY before its compatibility fallback",
);

console.log("Supabase modern server secret resolver contract: PASS");
