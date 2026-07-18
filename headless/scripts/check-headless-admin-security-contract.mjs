import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const headlessRoot = process.cwd();
const repositoryRoot = path.resolve(headlessRoot, "..");

async function readRepositoryFile(relativePath) {
  try {
    return await readFile(path.join(repositoryRoot, relativePath), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function compileCommonJs(source, filename, dependencies = {}, processEnvironment = {}) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
    process: { env: processEnvironment },
    Buffer,
    Headers,
    Response,
  });
  return module.exports;
}

const [
  authSource,
  proxySource,
  middlewareSource,
  revalidateSource,
  secretSource,
  functionsSource,
  envExampleSource,
  runbookSource,
  cutoverSource,
  packageSource,
] = await Promise.all([
  readRepositoryFile("headless/lib/dashboard/content-admin-auth.ts"),
  readRepositoryFile("headless/proxy.ts"),
  readRepositoryFile("headless/middleware.ts"),
  readRepositoryFile("headless/app/api/revalidate/route.ts"),
  readRepositoryFile("headless/lib/server/secure-secret.ts"),
  readRepositoryFile("functions.php"),
  readRepositoryFile("headless/.env.example"),
  readRepositoryFile("pm/RUNBOOK.md"),
  readRepositoryFile("pm/HEADLESS-CUTOVER-CHECKLIST.md"),
  readRepositoryFile("headless/package.json"),
]);

assert.equal(middlewareSource, "", "Next.js 16 must not retain middleware.ts");
assert.match(proxySource, /export function proxy/);
assert.match(proxySource, /isDashboardProtectedPath\(pathname\)/);
assert.match(proxySource, /authorizeDashboardRequest\(/);
assert.match(proxySource, /status:\s*503/);
assert.match(proxySource, /status:\s*401/);
assert.match(proxySource, /Cache-Control["']?,\s*["']no-store/);
assert.match(proxySource, /X-Robots-Tag["']?,\s*["']noindex, nofollow/);
assert.match(proxySource, /["']\/dashboard\/:path\*["']/);
assert.match(proxySource, /["']\/api\/dashboard\/:path\*["']/);
assert.match(proxySource, /["']\/wp-content\/themes\/swell_child\/dashboard\/:path\*["']/);

assert.match(authSource, /missing-configuration/);
assert.match(authSource, /missing-credentials/);
assert.match(authSource, /invalid-credentials/);
assert.match(authSource, /secretsMatch/);

assert.doesNotMatch(revalidateSource, /export async function GET/);
assert.match(revalidateSource, /secretsMatch/);
assert.match(revalidateSource, /function revalidateResponse/);
assert.match(revalidateSource, /Revalidation is not configured[\s\S]{0,100}503/);
assert.match(revalidateSource, /Invalid secret[\s\S]{0,100}401/);
assert.match(revalidateSource, /headers\.get\(["']x-revalidate-secret["']\)/);
assert.doesNotMatch(revalidateSource, /searchParams\.get\(["']secret["']\)/);

assert.match(functionsSource, /revalidate secret not configured; request skipped/);
assert.match(
  functionsSource,
  /\$secret\s*=\s*escomi_headless_revalidate_get_secret\(\);[\s\S]{0,500}\$secret\s*===\s*''[\s\S]{0,500}return;[\s\S]{0,1200}wp_remote_post\(/,
  "WordPress must stop before sending when the revalidate secret is empty",
);

assert.match(envExampleSource, /^DASHBOARD_BASIC_AUTH_USER=/m);
assert.match(envExampleSource, /^DASHBOARD_BASIC_AUTH_PASSWORD=/m);
assert.doesNotMatch(envExampleSource, /^BASIC_AUTH_(?:USER|PASSWORD)=/m);
assert.match(runbookSource, /fail-closed/);
assert.match(runbookSource, /pair-only/);
assert.match(runbookSource, /DAILY_UPDATE_PROXY_SECRET/);
assert.match(runbookSource, /wp user add-cap [^\n]+ escomi_update_daily_shop_data/);
assert.match(runbookSource, /wp user remove-cap [^\n]+ escomi_update_daily_shop_data/);
assert.match(runbookSource, /一般roleへ[^\n]+付与してはいけない/);
assert.doesNotMatch(
  runbookSource,
  /wp cap add\s+(?:administrator|editor)\s+escomi_update_daily_shop_data/,
);
assert.match(runbookSource, /dashboard_unauthenticated_status[\s\S]{0,500}["']401["']/);
assert.match(runbookSource, /printf\s+["']user = ["']?%s:%s/);
assert.match(runbookSource, /dashboard_authenticated_status[\s\S]{0,500}--config\s+-/);
assert.match(runbookSource, /dashboard_authenticated_status[\s\S]{0,500}["']200["']/);
assert.doesNotMatch(runbookSource, /curl\s+-I\s+-L\s+https:\/\/mens-esthe-kuchikomi\.com\/dashboard\//);
assert.doesNotMatch(runbookSource, /\/api\/revalidate\?[^\s`"']*(?:secret|tag)=/);
assert.doesNotMatch(cutoverSource, /\/api\/revalidate\?[^\s`"']*(?:secret|tag)=/);

const packageJson = JSON.parse(packageSource);
assert.equal(
  packageJson.scripts["test:headless-admin-security"],
  "node scripts/check-headless-admin-security-contract.mjs",
);
assert.match(packageJson.scripts.test, /test:headless-admin-security/);

const secretModule = compileCommonJs(secretSource, "secure-secret.ts", {
  "server-only": {},
  "node:crypto": await import("node:crypto"),
});
const authModule = compileCommonJs(authSource, "content-admin-auth.ts", {
  "server-only": {},
  "@/lib/server/secure-secret": secretModule,
});

assert.equal(authModule.isDashboardProtectedPath("/dashboard"), true);
assert.equal(authModule.isDashboardProtectedPath("/dashboard/content/shops"), true);
assert.equal(authModule.isDashboardProtectedPath("/api/dashboard/content/shops"), true);
assert.equal(
  authModule.isDashboardProtectedPath(
    "/wp-content/themes/swell_child/dashboard/api/report",
  ),
  true,
);
assert.equal(authModule.isDashboardProtectedPath("/api/revalidate"), false);
assert.equal(authModule.isDashboardProtectedPath("/dashboard-public"), false);

assert.equal(authModule.resolveContentAdminAuth(null, {}).reason, "missing-configuration");
assert.equal(
  authModule.resolveContentAdminAuth(null, { user: "qa", password: "secret" }).reason,
  "missing-credentials",
);
assert.equal(
  authModule.resolveContentAdminAuth("Basic d3Jvbmc6d3Jvbmc=", {
    user: "qa",
    password: "secret",
  }).reason,
  "invalid-credentials",
);
assert.equal(
  authModule.resolveContentAdminAuth("Basic cWE6c2VjcmV0", {
    user: "qa",
    password: "secret",
  }).ok,
  true,
);
assert.equal(authModule.authorizeDashboardRequest(null, {}).status, 503);
assert.equal(
  authModule.authorizeDashboardRequest("Basic d3Jvbmc6d3Jvbmc=", {
    user: "qa",
    password: "secret",
  }).status,
  401,
);
assert.equal(
  authModule.authorizeDashboardRequest("Basic cWE6c2VjcmV0", {
    user: "qa",
    password: "secret",
  }).status,
  200,
);

const officialEnvironment = {
  DASHBOARD_BASIC_AUTH_USER: "qa",
  DASHBOARD_BASIC_AUTH_PASSWORD: "secret",
};
const legacyEnvironment = {
  BASIC_AUTH_USER: "qa",
  BASIC_AUTH_PASSWORD: "secret",
};
assert.equal(
  authModule.authorizeDashboardRequest("Basic cWE6c2VjcmV0", officialEnvironment).status,
  200,
);
assert.equal(
  authModule.authorizeDashboardRequest("Basic cWE6c2VjcmV0", legacyEnvironment).status,
  200,
);
assert.equal(
  authModule.authorizeDashboardRequest("Basic cWE6c2VjcmV0", {
    DASHBOARD_BASIC_AUTH_USER: "qa",
    BASIC_AUTH_PASSWORD: "secret",
  }).status,
  503,
  "new and legacy environment variables must never be mixed",
);
assert.equal(
  authModule.authorizeDashboardRequest("Basic cWE6c2VjcmV0", {
    DASHBOARD_BASIC_AUTH_USER: "qa",
    BASIC_AUTH_USER: "qa",
    BASIC_AUTH_PASSWORD: "secret",
  }).status,
  503,
  "a partial official pair must not silently fall back to legacy variables",
);

function compileRevalidateRoute(revalidateTag, routeEnvironment = {}) {
  return compileCommonJs(
    revalidateSource,
    "revalidate-route.ts",
    {
      "next/cache": { revalidateTag },
      "next/server": {
        NextResponse: {
          json: (body, init) => Response.json(body, init),
        },
      },
      "@/lib/server/secure-secret": secretModule,
    },
    routeEnvironment,
  );
}

function revalidateRequest({ headerSecret = null, querySecret = null, tag = "wp" } = {}) {
  const url = new URL("https://example.test/api/revalidate");
  if (querySecret !== null) url.searchParams.set("secret", querySecret);
  const headers = new Headers({ "content-type": "application/json" });
  if (headerSecret !== null) headers.set("x-revalidate-secret", headerSecret);
  return {
    headers,
    nextUrl: url,
    json: async () => ({ tag }),
  };
}

async function assertSafeRevalidateResponse(response, expectedStatus) {
  assert.equal(response.status, expectedStatus);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
}

const revalidatedTags = [];
const routeEnvironment = {};
const routeModule = compileRevalidateRoute(
  (tag, profile) => revalidatedTags.push({ tag, profile }),
  routeEnvironment,
);

assert.equal(routeModule.GET, undefined);
let response = await routeModule.POST(revalidateRequest());
await assertSafeRevalidateResponse(response, 503);
routeEnvironment.REVALIDATE_SECRET = "server-secret";
response = await routeModule.POST(revalidateRequest({ querySecret: "server-secret" }));
await assertSafeRevalidateResponse(response, 401);
assert.equal(response.status, 401, "query secrets must be ignored");
response = await routeModule.POST(revalidateRequest({ headerSecret: "wrong" }));
await assertSafeRevalidateResponse(response, 401);
response = await routeModule.POST(
  revalidateRequest({ headerSecret: "server-secret", tag: "invalid tag" }),
);
await assertSafeRevalidateResponse(response, 400);
response = await routeModule.POST(revalidateRequest({ headerSecret: "server-secret" }));
await assertSafeRevalidateResponse(response, 200);
assert.deepEqual(revalidatedTags, [{ tag: "wp", profile: "max" }]);

const throwingRouteModule = compileRevalidateRoute(
  () => {
    throw new Error("test revalidation failure");
  },
  { REVALIDATE_SECRET: "server-secret" },
);
response = await throwingRouteModule.POST(
  revalidateRequest({ headerSecret: "server-secret" }),
);
await assertSafeRevalidateResponse(response, 500);
assert.deepEqual(await response.json(), {
  ok: false,
  message: "Revalidation failed",
});

console.log("headless admin security contract: PASS");
