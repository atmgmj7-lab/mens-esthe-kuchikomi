import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const source = readFileSync(resolve(root, "proxy.ts"), "utf8");

function response(kind, target = null) {
  return {
    kind,
    target,
    headers: new Headers(),
    cookies: { set() {} },
  };
}

function load(environment) {
  const output = ts.transpileModule(source, {
    fileName: "proxy.ts",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Headers,
    URL,
    process: { env: environment },
    require(specifier) {
      if (specifier === "next/server") return {
        NextResponse: {
          next: () => response("next"),
          rewrite: (target) => response("rewrite", target.toString()),
          redirect: (target) => response("redirect", target.toString()),
        },
      };
      if (specifier === "@/lib/dashboard/content-admin-auth") return {
        authorizeDashboardRequest: () => ({ status: 200 }),
        authorizeListingDashboardRequest: () => ({ status: 200 }),
        createDashboardSessionValue: () => null,
        dashboardSessionCookieName: () => "dashboard",
        isDashboardProtectedPath: () => false,
      };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  return module.exports;
}

function request(path, origin = "https://mens-esthe-kuchikomi.com") {
  const nextUrl = new URL(path, origin);
  return { nextUrl, url: nextUrl.toString(), headers: new Headers(), cookies: { get: () => undefined } };
}

const proxied = load({ ESKOMI_PUBLIC_FRONTEND_PROXY_ORIGIN: "https://escomi-headless-oysybx21x-narikiyos-projects.vercel.app" });
const rewritten = proxied.proxy(request("/shops/mrs-rank-up/?tab=review"));
assert.equal(rewritten.kind, "rewrite", "release proxy must keep the public hostname at Cloudflare while fetching the retained Vercel frontend");
assert.equal(rewritten.target, "https://escomi-headless-oysybx21x-narikiyos-projects.vercel.app/shops/mrs-rank-up/?tab=review");

const workersDev = proxied.proxy(request("/reviews/", "https://eskomi-workers-prep.eskomi.workers.dev"));
assert.equal(workersDev.headers.get("x-robots-tag"), "noindex, nofollow", "the workers.dev hostname must remain excluded even for a no-noindex release candidate");

const direct = load({});
assert.equal(direct.proxy(request("/shops/mrs-rank-up/")).kind, "next", "preview and local builds must not proxy unless the explicit release origin is configured");

console.log("Cloudflare release frontend proxy contract: PASS");
