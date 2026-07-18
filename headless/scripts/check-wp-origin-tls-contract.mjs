import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(join(root, file), "utf8");

const originRequestSource = read("lib/wp/origin-request.ts");
const originSource = read("lib/wp/origin.ts");

assert.match(originRequestSource, /from ["']node:https["']/, "origin transport must use node:https");
assert.doesNotMatch(originRequestSource, /from ["']node:http["']/, "origin transport must not import node:http");
assert.doesNotMatch(
  originRequestSource,
  /rejectUnauthorized\s*:\s*false/,
  "TLS certificate verification must never be disabled"
);
assert.match(originSource, /`https:\/\/\$\{WP_ORIGIN_IP\}`/, "origin base URL must be HTTPS");

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
          wpOriginHost: "mens-esthe-kuchikomi.com"
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
assert.equal(capturedOptions.servername, "mens-esthe-kuchikomi.com");
assert.equal(capturedOptions.rejectUnauthorized, true);
const upstreamHeaders = new Headers(capturedOptions.headers);
assert.equal(upstreamHeaders.get("host"), "mens-esthe-kuchikomi.com");
assert.equal(upstreamHeaders.get("authorization"), "Basic test-only-credential");
assert.equal(upstreamHeaders.get("cookie"), "wordpress_test_cookie=test-only");
assert.equal(Buffer.from(writtenBody).toString("utf8"), "{}");

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
