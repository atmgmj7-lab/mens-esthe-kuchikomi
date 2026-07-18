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
  monitorEnvExampleSource,
  monitorReadmeSource,
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
  readRepositoryFile("ai-site-monitor/.env.example"),
  readRepositoryFile("ai-site-monitor/README.md"),
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
assert.match(dailyWorkflow, /shop_post_id:/);
assert.match(dailyWorkflow, /TARGET_SHOP_POST_ID/);
assert.match(dailyWorkflow, /REQUIRE_AT_LEAST_ONE_UPDATE/);
assert.match(
  dailyWorkflow,
  /WP_SITE_URL="\$\{WP_SITE_URL%\/\}"/,
  "daily update preflight must remove a trailing slash from WP_SITE_URL",
);
assert.match(
  dailyWorkflow,
  /REST_UPDATE_URL="\$\{WP_SITE_URL\}\/wp-json\/escomi\/v1\/update\/"/,
  "daily update preflight must use the canonical trailing-slash endpoint",
);
assert.match(dailyWorkflow, /-X POST "\$\{REST_UPDATE_URL\}"/);

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

const monitorEnvEntries = new Map();
for (const line of monitorEnvExampleSource.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) monitorEnvEntries.set(match[1], match[2].trim());
}
assert.equal(monitorEnvEntries.get("DAILY_UPDATE_PROXY_SECRET"), "");
assert.match(
  monitorReadmeSource,
  /GitHub Secrets[\s\S]{0,1200}`WP_SITE_URL`[\s\S]{0,500}`DAILY_UPDATE_PROXY_SECRET`/,
);
assert.match(monitorReadmeSource, /Headless bridgeへ到達する公開URL/);
assert.match(
  monitorReadmeSource,
  /WP_USER[\s\S]{0,120}WP_APP_PASSWORD[\s\S]{0,200}日次callerでは使用しない/,
);

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

let rejectingCancelCalls = 0;
let rejectingCancelReleased = false;
const rejectingCancelResult = await proxyModule.readBoundedJsonBody(
  {
    getReader() {
      let delivered = false;
      return {
        read: async () => {
          if (delivered) return { done: true, value: undefined };
          delivered = true;
          return { done: false, value: new Uint8Array(MAX_BYTES + 1) };
        },
        cancel: async () => {
          rejectingCancelCalls += 1;
          throw new Error("cancel failed");
        },
        releaseLock: () => {
          rejectingCancelReleased = true;
        },
      };
    },
  },
  MAX_BYTES,
);
assert.equal(rejectingCancelResult.ok, false);
assert.equal(rejectingCancelResult.status, 413);
assert.ok(rejectingCancelCalls >= 1);
assert.equal(rejectingCancelReleased, true);

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

for (const validContentType of [
  "application/json",
  "application/json; charset=utf-8",
  " Application/JSON ; Charset = UTF-8 ",
]) {
  const validContentTypeResult = await proxyModule.buildDailyUpdateRequest({
    request: requestLike(
      oneByteStream(new TextEncoder().encode("{}")).stream,
      testEnvironment.proxySecret,
      validContentType,
    ),
    targetPath: "escomi/v1/update",
    environment: testEnvironment,
  });
  assert.equal(validContentTypeResult.ok, true, `allow ${validContentType}`);
}

for (const invalidContentType of [
  "text/plain",
  "application/json-patch+json",
  "application/json; profile=example",
  "application/json; charset=utf-16",
  "application/json; charset=utf-8; charset=utf-8",
  "application/json; charset=utf-8; profile=example",
]) {
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

let readErrorCancelled = false;
let readErrorReleased = false;
const readErrorResult = await proxyModule.readBoundedJsonBody(
  {
    getReader() {
      return {
        read: async () => {
          throw new Error("stream read failed");
        },
        cancel: async () => {
          readErrorCancelled = true;
        },
        releaseLock: () => {
          readErrorReleased = true;
        },
      };
    },
  },
  MAX_BYTES,
);
assert.equal(readErrorResult.ok, false);
assert.equal(readErrorResult.status, 400);
assert.equal(readErrorCancelled, true);
assert.equal(readErrorReleased, true);

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

const postResponse = proxyModule.buildWpProxyResponse(
  new Response("post-body", {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60",
      "x-wp-total": "7",
      "x-internal-debug": "drop-me",
      "set-cookie": "drop-me",
    },
  }),
  "POST",
);
assert.equal(await postResponse.text(), "post-body");
assert.equal(postResponse.headers.get("content-type"), "application/json");
assert.equal(postResponse.headers.get("x-wp-total"), "7");
assert.equal(postResponse.headers.get("cache-control"), "no-store");
assert.equal(postResponse.headers.has("x-internal-debug"), false);
assert.equal(postResponse.headers.has("set-cookie"), false);

const getResponse = proxyModule.buildWpProxyResponse(
  new Response("get-body", {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-wp-totalpages": "3",
      "x-internal-debug": "drop-me",
    },
  }),
  "GET",
);
assert.equal(await getResponse.text(), "get-body");
assert.equal(getResponse.headers.get("content-type"), "application/json; charset=utf-8");
assert.equal(getResponse.headers.get("cache-control"), "public, max-age=60");
assert.equal(getResponse.headers.get("x-wp-totalpages"), "3");
assert.equal(getResponse.headers.has("x-internal-debug"), false);

const headResponse = proxyModule.buildWpProxyResponse(
  new Response("must-not-pass", {
    status: 200,
    headers: { "content-type": "application/json", "x-wp-total": "2" },
  }),
  "HEAD",
);
assert.equal(await headResponse.text(), "");
assert.equal(headResponse.headers.get("content-type"), "application/json");
assert.equal(headResponse.headers.get("x-wp-total"), "2");

console.log("Daily update proxy contract: PASS");
