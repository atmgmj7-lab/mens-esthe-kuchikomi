import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(join(root, file), "utf8");

function requireFromOriginRequest(id) {
  if (id === "node:http") {
    return {
      request() {
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {};
        req.destroy = (error) => req.emit("error", error);
        req.setTimeout = (ms, onTimeout) => {
          setTimeout(onTimeout, Math.max(0, Math.min(ms, 10)));
          return req;
        };
        return req;
      }
    };
  }

  if (id === "@/lib/wp/origin") {
    return {
      WP_ORIGIN_IP: "127.0.0.1",
      wpOriginHost: "example.test"
    };
  }

  throw new Error(`Unexpected import in origin-request test: ${id}`);
}

async function assertOriginRequestTimesOut() {
  const source = read("lib/wp/origin-request.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;

  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      Blob,
      Buffer,
      Headers,
      Response,
      clearTimeout,
      console,
      exports: module.exports,
      module,
      require: requireFromOriginRequest,
      setTimeout
    },
    { filename: "origin-request.cjs" }
  );

  const result = await Promise.race([
    module.exports
      .requestWpOrigin("/wp-json/", { timeoutMs: 5 })
      .then(() => ({ status: "resolved" }))
      .catch((error) => ({ status: "rejected", error })),
    new Promise((resolve) => setTimeout(() => resolve({ status: "pending" }), 50))
  ]);

  assert.notEqual(
    result.status,
    "pending",
    "origin request must reject when the upstream socket does not respond"
  );
  assert.equal(result.status, "rejected", "origin timeout must reject instead of resolving");
  assert.match(String(result.error?.message || result.error), /timed out/i);
}

await assertOriginRequestTimesOut();

const originRequest = read("lib/wp/origin-request.ts");
assert.ok(originRequest.includes("timeoutMs"), "origin request must expose timeoutMs option");
assert.ok(originRequest.includes("req.setTimeout"), "origin request must set a socket timeout");

const buildResilience = read("lib/wp/build-resilience.ts");
assert.ok(buildResilience.includes("getStaticParamsOrFallback"), "static params fallback helper must exist");
assert.ok(buildResilience.includes("withWpBuildFallback"), "build fallback helper must exist");

const areaRoute = read("app/area/[slug]/page.tsx");
assert.ok(areaRoute.includes("getStaticParamsOrFallback"), "area static params must use a non-empty fallback");
assert.ok(areaRoute.includes('slug: "osaka"'), "area static params fallback must include a known area");

const columnRoute = read("app/column/[slug]/page.tsx");
assert.ok(columnRoute.includes("getStaticParamsOrFallback"), "column static params must use a non-empty fallback");
assert.ok(columnRoute.includes('slug: "hello-world"'), "column static params fallback must include a known post");

const shopRoute = read("app/shops/[slug]/page.tsx");
assert.ok(shopRoute.includes("getStaticParamsOrFallback"), "shop static params must use a non-empty fallback");

const columnIndex = read("app/column/page.tsx");
assert.ok(columnIndex.includes("withWpBuildFallback"), "column index must render when WP posts fail");

const shopsIndex = read("app/shops/page.tsx");
assert.ok(shopsIndex.includes("withWpBuildFallback"), "shops index must render when WP listing data fails");

const staticPage = read("app/[slug]/page.tsx");
assert.ok(staticPage.includes("withWpBuildFallback"), "static WP pages must use local fallback content");

console.log("WP build resilience checks passed");
