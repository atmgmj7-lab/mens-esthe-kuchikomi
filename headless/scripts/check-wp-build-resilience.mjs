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
  if (id === "node:https") {
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
      URL,
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

  return module.exports;
}

const originRequestModule = await assertOriginRequestTimesOut();

function assertOriginTimeoutValidation() {
  for (const invalidTimeout of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
    assert.equal(
      originRequestModule.resolveWpOriginTimeoutMs(invalidTimeout),
      10_000,
      `invalid WordPress timeout must use the safe default: ${invalidTimeout}`
    );
  }

  for (const validTimeout of [1, 10_000, 2_147_483_647]) {
    assert.equal(
      originRequestModule.resolveWpOriginTimeoutMs(validTimeout),
      validTimeout,
      `safe WordPress timeout must be preserved: ${validTimeout}`
    );
  }
}

function loadWpClient({
  fetchImpl = () => Promise.reject(new Error("unexpected native fetch")),
  originRequestImpl,
  timeoutMs = "5",
  apiBase = "https://wp.example.test/wp-json",
  publicBase = "https://www.example.test"
}) {
  const source = read("lib/wp/client.ts");
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
      AbortController,
      AbortSignal,
      Blob,
      Headers,
      Response,
      URL,
      clearTimeout,
      console,
      exports: module.exports,
      fetch: fetchImpl,
      module,
      process: {
        env: {
          NEXT_PUBLIC_WP_BASE_URL: publicBase,
          WP_API_BASE_URL: apiBase,
          WP_ORIGIN_TIMEOUT_MS: timeoutMs
        }
      },
      require(id) {
        if (id === "@/lib/wp/origin-request") {
          return {
            requestWpOrigin(...args) {
              if (originRequestImpl) return originRequestImpl(...args);
              throw new Error("native fetch test must not use the direct IP request path");
            },
            resolveWpOriginTimeoutMs(value) {
              const candidate = value ?? Number(timeoutMs);
              return Number.isFinite(candidate) && candidate > 0 ? candidate : 10_000;
            }
          };
        }
        if (id === "@/lib/wp/origin") {
          return {
            WP_ORIGIN_IP: "127.0.0.1",
            usesWpOriginIp: (value) =>
              value.includes("85.131.213.108") || value.includes("127.0.0.1"),
            wpOriginBaseUrl: "https://127.0.0.1",
            wpOriginHost: "wp.example.test"
          };
        }
        throw new Error(`Unexpected import in wp client test: ${id}`);
      },
      setTimeout
    },
    { filename: "wp-client.cjs" }
  );

  return module.exports;
}

async function assertPlaintextWpApiConfigCannotReceiveAuthorization() {
  let nativeFetchCalled = false;
  let originRequest;
  const client = loadWpClient({
    apiBase: "http://cms.example.test/wp-json",
    fetchImpl: async () => {
      nativeFetchCalled = true;
      return new Response("[]", { status: 200 });
    },
    originRequestImpl: async (path, init) => {
      originRequest = { path, init };
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  await client.wpFetch("/wp/v2/shop/42", {
    method: "POST",
    headers: {
      Authorization: "Basic test-only-credential",
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  assert.equal(
    client.wpApiBase,
    "https://85.131.213.108/wp-json",
    "plaintext WordPress API configuration must fall back to the verified TLS origin"
  );
  assert.equal(nativeFetchCalled, false, "Authorization must never be sent with native HTTP fetch");
  assert.equal(originRequest?.path, "/wp-json/wp/v2/shop/42");
  assert.equal(
    new Headers(originRequest?.init?.headers).get("authorization"),
    "Basic test-only-credential",
    "Authorization may be forwarded only through the verified TLS origin helper"
  );
}

function assertWpApiBaseValidation() {
  const defaultApiBase = "https://85.131.213.108/wp-json";
  const defaultPublicBase = "https://mens-esthe-kuchikomi.com";

  for (const invalidPublicBase of ["", "[SENSITIVE]", "/", "not a URL", "javascript:alert(1)"]) {
    const client = loadWpClient({ publicBase: invalidPublicBase });
    assert.equal(
      client.wpBase,
      defaultPublicBase,
      `invalid public WordPress base must use the site fallback: ${invalidPublicBase}`
    );
  }

  const validPublicBase = "https://www.example.test";
  const publicClient = loadWpClient({ publicBase: validPublicBase });
  assert.equal(
    publicClient.wpBase,
    validPublicBase,
    "valid absolute public WordPress base must be preserved"
  );

  for (const invalidApiBase of ["", "[SENSITIVE]", "/wp-json", "not a URL", "ftp://wp.example.test"]) {
    const client = loadWpClient({ apiBase: invalidApiBase });
    assert.equal(
      client.wpApiBase,
      defaultApiBase,
      `invalid WordPress API base must use the direct origin fallback: ${invalidApiBase}`
    );
  }

  const validApiBase = "https://cms.example.test/wp-json";
  const client = loadWpClient({ apiBase: validApiBase });
  assert.equal(client.wpApiBase, validApiBase, "valid absolute WordPress API base must be preserved");

  const nestedApiBase = "https://cms.example.test/subdir/wp-json/";
  const nestedClient = loadWpClient({ apiBase: nestedApiBase });
  assert.equal(
    nestedClient.wpApiBase,
    "https://cms.example.test/subdir/wp-json",
    "WordPress API base must preserve its path and remove the trailing slash"
  );

  const rootClient = loadWpClient({ publicBase: "https://www.example.test/" });
  assert.equal(rootClient.wpBase, "https://www.example.test", "origin root slash must be normalized");

  for (const unsafeApiBase of [
    "https://user:password@cms.example.test/wp-json",
    "https://cms.example.test/wp-json?",
    "https://cms.example.test/wp-json?preview=1",
    "https://cms.example.test/wp-json#",
    "https://cms.example.test/wp-json#preview"
  ]) {
    const unsafeClient = loadWpClient({ apiBase: unsafeApiBase });
    assert.equal(
      unsafeClient.wpApiBase,
      defaultApiBase,
      "WordPress API base must reject credentials, query strings, and fragments"
    );
  }

  for (const unsafePublicBase of [
    "https://user:password@www.example.test",
    "https://www.example.test?",
    "https://www.example.test?preview=1",
    "https://www.example.test#",
    "https://www.example.test#preview"
  ]) {
    const unsafeClient = loadWpClient({ publicBase: unsafePublicBase });
    assert.equal(
      unsafeClient.wpBase,
      defaultPublicBase,
      "public WordPress base must reject credentials, query strings, and fragments"
    );
  }
}

async function assertNormalizedUrlsAreUsed() {
  let requestedUrl;
  const client = loadWpClient({
    apiBase: "https://cms.example.test/subdir/wp-json/",
    publicBase: "https://www.example.test/wordpress/",
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  await client.wpFetch("/wp/v2/pages?slug=about");
  assert.equal(
    requestedUrl,
    "https://cms.example.test/subdir/wp-json/wp/v2/pages?slug=about",
    "WordPress request URL must preserve the configured path without a double slash"
  );
  assert.equal(
    client.absoluteUrl("/wp-content/uploads/image.jpg"),
    "https://www.example.test/wordpress/wp-content/uploads/image.jpg",
    "public WordPress URL must preserve the configured path without a double slash"
  );
}

function createHangingFetch(onRequest) {
  return (_url, init) => {
    onRequest?.(init);
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
}

async function assertNativeFetchTimesOutIntoFallback() {
  let requestInit;
  const client = loadWpClient({
    fetchImpl: createHangingFetch((init) => {
      requestInit = init;
    })
  });

  const result = await Promise.race([
    client
      .wpFetch("/wp/v2/pages?slug=about", {
        next: { revalidate: 300, tags: ["wp", "pages"] }
      })
      .then(() => ({ status: "resolved" }))
      .catch((error) => ({ status: "fallback", error })),
    new Promise((resolve) => setTimeout(() => resolve({ status: "pending" }), 100))
  ]);

  assert.equal(
    result.status,
    "fallback",
    "native WordPress fetch must reject in time for the build fallback"
  );
  assert.ok(requestInit?.signal, "native WordPress fetch must receive an abort signal");
  assert.deepEqual(
    JSON.parse(JSON.stringify(requestInit.next)),
    { revalidate: 300, tags: ["wp", "pages"] },
    "native WordPress fetch must preserve Next.js cache options"
  );
}

async function assertNativeFetchPreservesCallerAbort() {
  const caller = new AbortController();
  const client = loadWpClient({
    fetchImpl: createHangingFetch(),
    timeoutMs: "1000"
  });
  const request = client
    .wpFetch("/wp/v2/pages?slug=about", { signal: caller.signal })
    .then(() => ({ status: "resolved" }))
    .catch((error) => ({ status: "rejected", error }));

  caller.abort(new Error("caller cancelled"));
  const result = await Promise.race([
    request,
    new Promise((resolve) => setTimeout(() => resolve({ status: "pending" }), 100))
  ]);

  assert.equal(result.status, "rejected", "caller abort must still cancel the native fetch");
  assert.match(String(result.error?.message || result.error), /caller cancelled/);
}

assertWpApiBaseValidation();
await assertPlaintextWpApiConfigCannotReceiveAuthorization();
await assertNormalizedUrlsAreUsed();
assertOriginTimeoutValidation();
await assertNativeFetchTimesOutIntoFallback();
await assertNativeFetchPreservesCallerAbort();

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
assert.ok(shopRoute.includes("getStaticParamsOrFallback"), "shop static params must use the build fallback helper");
assert.ok(
  shopRoute.includes('slug: "__wp-build-fallback__"'),
  "shop static params must use a non-public sentinel when WP is unavailable during build"
);
assert.doesNotMatch(
  shopRoute,
  /c-r-e-a-m%ef%bc%88/,
  "shop static params must not hard-code a shop whose data may be unavailable during build"
);

const columnIndex = read("app/column/page.tsx");
assert.ok(columnIndex.includes("withWpBuildFallback"), "column index must render when WP posts fail");

const shopsIndex = read("app/shops/page.tsx");
assert.ok(shopsIndex.includes("withWpBuildFallback"), "shops index must render when WP listing data fails");

const staticPage = read("app/[slug]/page.tsx");
assert.ok(staticPage.includes("withWpBuildFallback"), "static WP pages must use local fallback content");

console.log("WP build resilience checks passed");
