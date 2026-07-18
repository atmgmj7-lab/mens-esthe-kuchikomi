import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const headlessRoot = process.cwd();
const repositoryRoot = path.resolve(headlessRoot, "..");
const readRepositoryFile = (relativePath) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

const routeSource = await readRepositoryFile("headless/app/wp-json/[[...path]]/route.ts");

assert.doesNotMatch(
  routeSource,
  /request\.headers\.get\(["']authorization["']\)/i,
  "the public proxy must discard the browser Authorization header",
);

const [
  proxySource,
  secretSource,
  dailyWorkflow,
  monthlyWorkflow,
  packageSource,
  autoUpdaterSource,
  hourlyUpdaterSource,
  monthlyUpdaterSource,
  priceMigratorSource,
  crawlerBaseSource,
  crawlEngineSource,
  shopPromptSource,
  deployGuideSource,
  crawlGuideSource,
] = await Promise.all([
  readRepositoryFile("headless/lib/wp/daily-update-proxy.ts"),
  readRepositoryFile("headless/lib/server/secure-secret.ts"),
  readRepositoryFile(".github/workflows/daily_shop_update.yml"),
  readRepositoryFile(".github/workflows/monthly_shop_summary.yml"),
  readRepositoryFile("headless/package.json"),
  readRepositoryFile("ai-site-monitor/ai_auto_updater.py"),
  readRepositoryFile("ai-site-monitor/hourly_schedule_updater.py"),
  readRepositoryFile("ai-site-monitor/ai_monthly_updater.py"),
  readRepositoryFile("ai-site-monitor/price_migrator.py"),
  readRepositoryFile("ai-site-monitor/crawler_base.py"),
  readRepositoryFile("tools/ai_crawl_engine.py"),
  readRepositoryFile("SHOP-prompt.md"),
  readRepositoryFile("DEPLOY-AI-UPDATE.md"),
  readRepositoryFile("tools/AI-CRAWL-README.md"),
]);

const combinedProxySource = `${routeSource}\n${proxySource}`;
assert.match(combinedProxySource, /targetPath\s*!==\s*["']escomi\/v1\/update["']/);
assert.match(combinedProxySource, /DAILY_UPDATE_PROXY_SECRET/);
assert.match(combinedProxySource, /WP_DAILY_UPDATE_USER/);
assert.match(combinedProxySource, /WP_DAILY_UPDATE_APP_PASSWORD/);
assert.match(combinedProxySource, /status:\s*503/);
assert.match(combinedProxySource, /status:\s*401/);
assert.match(proxySource, /reader\.cancel\s*\(/);
assert.doesNotMatch(combinedProxySource, /\.arrayBuffer\s*\(/);
assert.match(secretSource, /timingSafeEqual/);

assert.match(monthlyWorkflow, /workflow_dispatch/);
assert.doesNotMatch(monthlyWorkflow, /schedule:/);
assert.match(monthlyWorkflow, /Supabase staging/);
assert.match(dailyWorkflow, /DAILY_UPDATE_PROXY_SECRET/);
assert.doesNotMatch(dailyWorkflow, /secrets\.WP_(?:USER|APP_PASSWORD)/);

for (const [label, source] of [
  ["daily updater", autoUpdaterSource],
  ["hourly updater", hourlyUpdaterSource],
]) {
  assert.match(source, /x-escomi-daily-update-secret/i, `${label} must use the dedicated header`);
  assert.match(source, /str\(uuid\.uuid4\(\)\)/, `${label} must create a request UUID per write`);
  assert.doesNotMatch(source, /requests\.post\([\s\S]{0,500}auth\s*=/, `${label} must not use Basic auth`);
}

for (const [label, source] of [
  ["monthly updater", monthlyUpdaterSource],
  ["price migrator", priceMigratorSource],
  ["generic crawl engine", crawlEngineSource],
]) {
  assert.doesNotMatch(source, /requests\.post\s*\(/, `${label} public writes must be disabled`);
  assert.doesNotMatch(source, /wp-json\/escomi\/v1\/update/, `${label} must not target the daily route`);
}
assert.doesNotMatch(crawlerBaseSource, /Authorization/);

for (const [label, source] of [
  ["SHOP prompt", shopPromptSource],
  ["deploy guide", deployGuideSource],
  ["crawl guide", crawlGuideSource],
]) {
  assert.doesNotMatch(source, /WP_USER|WP_APP_PASSWORD/, `${label} must not retain old caller credentials`);
  assert.doesNotMatch(source, /auth\s*=|Authorization:\s*Basic/i, `${label} must not retain copyable direct POST auth`);
}

const packageJson = JSON.parse(packageSource);
assert.equal(
  packageJson.scripts["test:daily-update-proxy"],
  "node scripts/check-daily-update-proxy-contract.mjs && cd ../ai-site-monitor && python3 -m unittest tests.test_daily_update_payload",
);
assert.match(packageJson.scripts.test, /test:daily-update-proxy/);

function compileCommonJs(source, filename, dependencies = {}) {
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
    process: { env: {} },
    Buffer,
    Headers,
    Response,
    ReadableStream,
    TextDecoder,
    Uint8Array,
  });
  return module.exports;
}

const secretModule = compileCommonJs(secretSource, "secure-secret.ts", {
  "server-only": {},
  "node:crypto": await import("node:crypto"),
});
const proxyModule = compileCommonJs(proxySource, "daily-update-proxy.ts", {
  "server-only": {},
  "@/lib/server/secure-secret": secretModule,
  "node:buffer": await import("node:buffer"),
});

assert.equal(secretModule.secretsMatch("same-value", "same-value"), true);
assert.equal(secretModule.secretsMatch("same-value", "different-value"), false);

const MAX_BYTES = 262_144;
const testEnvironment = {
  proxySecret: "test-proxy-secret",
  wpUser: "test-daily-user",
  wpAppPassword: "test-application-password",
};
const processEnvironment = {
  DAILY_UPDATE_PROXY_SECRET: testEnvironment.proxySecret,
  WP_DAILY_UPDATE_USER: testEnvironment.wpUser,
  WP_DAILY_UPDATE_APP_PASSWORD: testEnvironment.wpAppPassword,
};
assert.deepEqual(
  JSON.parse(JSON.stringify(proxyModule.readDailyUpdateEnvironment(processEnvironment))),
  testEnvironment,
);
for (const missingKey of Object.keys(processEnvironment)) {
  const incompleteEnvironment = { ...processEnvironment };
  delete incompleteEnvironment[missingKey];
  assert.equal(proxyModule.readDailyUpdateEnvironment(incompleteEnvironment), null);
}

function oneByteStream(bytes) {
  let offset = 0;
  const state = { pulls: 0, cancelled: false, readerCancelled: false };
  const rawStream = new ReadableStream({
    pull(controller) {
      state.pulls += 1;
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + 1));
      offset += 1;
    },
    cancel() {
      state.cancelled = true;
    },
  });
  const stream = {
    getReader() {
      const reader = rawStream.getReader();
      return {
        read: () => reader.read(),
        cancel: () => {
          state.readerCancelled = true;
          return reader.cancel();
        },
        releaseLock: () => reader.releaseLock(),
      };
    },
  };
  return { stream, state };
}

function requestLike(
  body,
  secret = testEnvironment.proxySecret,
  contentType = "application/json",
) {
  const headers = new Headers({ "content-type": contentType });
  if (secret !== null) headers.set("x-escomi-daily-update-secret", secret);
  return { body, headers };
}

const exactBytes = new TextEncoder().encode(`"${"a".repeat(MAX_BYTES - 2)}"`);
assert.equal(exactBytes.byteLength, MAX_BYTES);
const exactStream = oneByteStream(exactBytes);
const exactResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(exactStream.stream),
  targetPath: "escomi/v1/update",
  environment: testEnvironment,
});
assert.equal(exactResult.ok, true, "a valid JSON body of exactly 256KB must pass");
assert.equal(exactResult.body.byteLength, MAX_BYTES);
assert.equal(exactStream.state.readerCancelled, false);

const oversizeBytes = new TextEncoder().encode(`"${"b".repeat(MAX_BYTES - 1)}"`);
assert.equal(oversizeBytes.byteLength, MAX_BYTES + 1);
const oversizeStream = oneByteStream(oversizeBytes);
const oversizeResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(oversizeStream.stream),
  targetPath: "escomi/v1/update",
  environment: testEnvironment,
});
assert.equal(oversizeResult.ok, false);
assert.equal(oversizeResult.status, 413);
assert.equal(oversizeStream.state.readerCancelled, true);
assert.ok(
  oversizeStream.state.pulls <= MAX_BYTES + 2,
  "the bounded reader must stop without consuming the remainder",
);

let unknownBodyRead = false;
const unknownBody = {
  getReader() {
    unknownBodyRead = true;
    throw new Error("unknown path body must not be read");
  },
};
const unknownResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(unknownBody),
  targetPath: "wp/v2/shop/1",
  environment: testEnvironment,
});
assert.equal(unknownResult.ok, false);
assert.equal(unknownResult.status, 405);
assert.equal(unknownBodyRead, false, "unknown paths must be rejected before reading the body");

const missingEnvResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(null),
  targetPath: "escomi/v1/update",
  environment: null,
});
assert.equal(missingEnvResult.ok, false);
assert.equal(missingEnvResult.status, 503);

const unauthorizedResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(null, null),
  targetPath: "escomi/v1/update",
  environment: testEnvironment,
});
assert.equal(unauthorizedResult.ok, false);
assert.equal(unauthorizedResult.status, 401);

const wrongSecretResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(null, "wrong-secret"),
  targetPath: "escomi/v1/update",
  environment: testEnvironment,
});
assert.equal(wrongSecretResult.ok, false);
assert.equal(wrongSecretResult.status, 401);

const invalidJsonStream = oneByteStream(new TextEncoder().encode("{invalid"));
const invalidJsonResult = await proxyModule.buildDailyUpdateRequest({
  request: requestLike(invalidJsonStream.stream),
  targetPath: "escomi/v1/update",
  environment: testEnvironment,
});
assert.equal(invalidJsonResult.ok, false);
assert.equal(invalidJsonResult.status, 400);

for (const invalidContentType of ["text/plain", "application/json-patch+json"]) {
  let contentTypeBodyRead = false;
  const contentTypeBody = {
    getReader() {
      contentTypeBodyRead = true;
      throw new Error("invalid content type body must not be read");
    },
  };
  const contentTypeResult = await proxyModule.buildDailyUpdateRequest({
    request: requestLike(
      contentTypeBody,
      testEnvironment.proxySecret,
      invalidContentType,
    ),
    targetPath: "escomi/v1/update",
    environment: testEnvironment,
  });
  assert.equal(contentTypeResult.ok, false);
  assert.equal(contentTypeResult.status, 400);
  assert.equal(contentTypeBodyRead, false);
}

const upstreamHeaders = proxyModule.buildDailyUpdateUpstreamHeaders(testEnvironment);
assert.deepEqual(
  [...upstreamHeaders.keys()].sort(),
  ["authorization", "content-type"],
);
assert.equal(upstreamHeaders.get("content-type"), "application/json");
assert.equal(
  upstreamHeaders.get("authorization"),
  `Basic ${Buffer.from(`${testEnvironment.wpUser}:${testEnvironment.wpAppPassword}`).toString("base64")}`,
);

for (const upstreamStatus of [200, 401, 403]) {
  const upstreamResponse = new Response("upstream", { status: upstreamStatus });
  const proxyResponse = proxyModule.buildWpProxyResponse(upstreamResponse, "POST");
  assert.equal(proxyResponse.status, upstreamStatus);
  assert.equal(proxyResponse.headers.get("cache-control"), "no-store");
}

console.log("Daily update proxy contract: PASS");
