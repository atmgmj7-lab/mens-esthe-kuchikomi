import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(join(root, file), "utf8");

const originRequestSource = read("lib/wp/origin-request.ts");
const originConfigSource = read("lib/wp/origin-config.mjs");
const originConfig = await import(new URL("../lib/wp/origin-config.mjs", import.meta.url));
const cutoverChecklist = readFileSync(
  join(root, "../pm/HEADLESS-CUTOVER-CHECKLIST.md"),
  "utf8"
);

assert.match(originRequestSource, /from ["']node:https["']/, "origin transport must use node:https");
assert.doesNotMatch(originRequestSource, /from ["']node:http["']/, "origin transport must not import node:http");
assert.doesNotMatch(
  originRequestSource,
  /rejectUnauthorized\s*:\s*false/,
  "TLS certificate verification must never be disabled"
);
assert.equal(new URL(originConfig.wpOriginBaseUrl).protocol, "https:", "origin base URL must be HTTPS");
assert.equal(
  originConfig.wpOriginTlsServername,
  "sv16727.xserver.jp",
  "default TLS name must match the verified Xserver certificate"
);
assert.equal(
  originConfig.wpOriginHost,
  "mens-esthe-kuchikomi.com",
  "default HTTP Host must select the canonical WordPress virtual host"
);
assert.doesNotMatch(
  originConfigSource,
  /NEXT_PUBLIC_WP_ORIGIN_TLS_SERVERNAME/,
  "the TLS origin name must remain server-only"
);
assert.match(cutoverChecklist, /https:\/\/85\.131\.213\.108\/wp-json/);
assert.doesNotMatch(cutoverChecklist, /WP_API_BASE_URL[^\n]+http:\/\/85\.131\.213\.108/);
assert.match(cutoverChecklist, /85\.131\.213\.108:443/);
assert.match(cutoverChecklist, /TLS SNI/);
assert.match(cutoverChecklist, /rejectUnauthorized/);

let capturedOptions;
let writtenBody;
let requestCount = 0;

const compiled = ts.transpileModule(originRequestSource, {
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
    process: { env: {} },
    require(id) {
      if (id === "node:https") {
        return {
          request(options, onResponse) {
            requestCount += 1;
            capturedOptions = options;
            const request = new EventEmitter();
            request.setTimeout = () => request;
            request.destroy = (error) => request.emit("error", error);
            request.write = (body) => {
              writtenBody = body;
            };
            request.end = () => {
              const response = new EventEmitter();
              response.statusCode = 302;
              response.statusMessage = "Found";
              response.headers = {
                location: "https://mens-esthe-kuchikomi.com/wp-login.php"
              };
              onResponse(response);
              response.emit("data", Buffer.from('{"ok":true}'));
              response.emit("end");
            };
            return request;
          }
        };
      }
      if (id === "@/lib/wp/origin") {
        return {
          WP_ORIGIN_IP: "85.131.213.108",
          wpOriginHost: "mens-esthe-kuchikomi.com",
          wpOriginTlsServername: "sv16727.xserver.jp"
        };
      }
      throw new Error(`Unexpected import in origin TLS test: ${id}`);
    },
    setTimeout
  },
  { filename: "origin-request-tls.cjs" }
);

const response = await module.exports.requestWpOrigin("/wp-json/escomi/v1/update", {
  method: "POST",
  headers: {
    Authorization: "Basic test-only-credential",
    Cookie: "wordpress_test_cookie=test-only",
    "Content-Type": "application/json"
  },
  body: "{}",
  forwardCookies: true
});

assert.equal(response.status, 302, "origin redirects must be returned without automatic follow");
assert.equal(requestCount, 1, "origin helper must not open a second request for redirects");
assert.equal(capturedOptions.hostname, "85.131.213.108");
assert.equal(capturedOptions.port, 443);
assert.equal(
  capturedOptions.servername,
  "sv16727.xserver.jp",
  "TLS verification must use the certificate-matching Xserver name"
);
assert.equal(capturedOptions.rejectUnauthorized, true);
const upstreamHeaders = new Headers(capturedOptions.headers);
assert.equal(
  upstreamHeaders.get("host"),
  "mens-esthe-kuchikomi.com",
  "HTTP Host must continue routing to the canonical WordPress virtual host"
);
assert.equal(upstreamHeaders.get("authorization"), "Basic test-only-credential");
assert.equal(upstreamHeaders.get("cookie"), "wordpress_test_cookie=test-only");
assert.equal(Buffer.from(writtenBody).toString("utf8"), "{}");

function runCriticalPreflightWithTlsServername(servername) {
  return spawnSync(
    process.execPath,
    [join(root, "scripts/wp-critical-build-preflight.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        WP_ORIGIN_HOST: originConfig.wpOriginHost,
        WP_ORIGIN_TLS_SERVERNAME: servername
      },
      timeout: 30_000
    }
  );
}

const validTlsPreflight = runCriticalPreflightWithTlsServername(
  originConfig.wpOriginTlsServername
);
assert.equal(
  validTlsPreflight.status,
  0,
  `the configured certificate-matching TLS server name must reach WordPress: ${validTlsPreflight.stderr}`
);
assert.match(validTlsPreflight.stdout, /critical WordPress Area shinosaka: PASS/);
assert.match(validTlsPreflight.stdout, /critical WordPress Area sakai: PASS/);

const invalidTlsPreflight = runCriticalPreflightWithTlsServername("invalid.example");
assert.notEqual(
  invalidTlsPreflight.status,
  0,
  "a reserved nonmatching TLS server name must fail hostname verification"
);
assert.match(
  invalidTlsPreflight.stderr,
  /Hostname\/IP does not match certificate's altnames|ERR_TLS_CERT_ALTNAME_INVALID/,
  "the negative probe must fail specifically at TLS hostname verification"
);

for (const routeFile of [
  "app/wp-json/[[...path]]/route.ts",
  "app/wp-admin/[[...path]]/route.ts",
  "app/api/proxy/wp-login/route.ts",
  "app/wp-content/[...path]/route.ts",
  "lib/wp/review-submit.ts"
]) {
  const source = read(routeFile);
  assert.match(source, /requestWpOrigin/, `${routeFile} must use the verified origin helper`);
  assert.doesNotMatch(source, /node:http/, `${routeFile} must not open a plaintext origin socket`);
}

console.log("WordPress origin TLS contract checks passed");
