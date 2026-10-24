import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectDirectory, "package.json"), "utf8"));
const generatorPath = join(scriptsDirectory, "build-cloudflare-dynamic-public-read.mjs");
const verifierPath = join(scriptsDirectory, "verify-cloudflare-dynamic-deploy-input.mjs");
const deployPath = join(scriptsDirectory, "deploy-cloudflare-dynamic-production.mjs");
const configPath = join(projectDirectory, "wrangler.production.jsonc");

assert.equal(
  packageJson.scripts?.["workers:production-prepare"],
  "node scripts/build-cloudflare-dynamic-public-read.mjs --production --prepare-only",
  "direct production preparation must use an isolated production-derived source",
);
assert.equal(existsSync(configPath), true, "a direct-production Worker config is required");
const config = readFileSync(configPath, "utf8");
assert.match(config, /"name":\s*"eskomi-workers-production"/u, "direct production must not overwrite the preview Worker");
assert.doesNotMatch(config, /ESKOMI_WORKERS_PREVIEW_NO_INDEX|ESKOMI_PUBLIC_FRONTEND_PROXY_ORIGIN/u, "direct production config must carry neither preview noindex nor Vercel proxy state");
assert.doesNotMatch(config, /"routes"|"route"|"custom_domains"/u, "direct production config must not attach a hostname before separate zone and DNS approval");

const prepared = spawnSync(process.execPath, [generatorPath, "--production"], {
  cwd: projectDirectory,
  encoding: "utf8",
});
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const root = `${prepared.stdout}\n${prepared.stderr}`.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu)?.[1]?.trim();
assert.ok(root, "direct production preparation must report its derived root");
const manifest = JSON.parse(readFileSync(join(root, "dynamic-source-manifest.json"), "utf8"));
assert.equal(manifest.target, "production", "production provenance must not be reusable as preview or proxy release provenance");
assert.equal(manifest.runtimeConfig, "wrangler.production.jsonc", "production provenance must pin the direct production config");
assert.equal(existsSync(join(root, "public", "_headers")), false, "production output must not carry preview static noindex headers");
const verified = spawnSync(process.execPath, [verifierPath, "--root", root, "--target", "production"], { cwd: projectDirectory, encoding: "utf8" });
assert.equal(verified.status, 0, verified.stderr || verified.stdout);

assert.equal(existsSync(deployPath), true, "direct production deploy must use a guarded wrapper");
const deploy = readFileSync(deployPath, "utf8");
assert.match(deploy, /--target", "production"/u, "direct production wrapper must reject non-production provenance");
assert.match(deploy, /wrangler\.production\.jsonc/u, "direct production wrapper must deploy only the production Worker config");
assert.match(deploy, /SUPABASE_CONTENT_EXPECTED_SHOPS:393/u, "direct production wrapper must pin the audited public shop count");
assert.match(deploy, /SUPABASE_CONTENT_EXPECTED_AREAS:34/u, "direct production wrapper must pin the audited public area count");
assert.match(deploy, /SUPABASE_CONTENT_EXPECTED_POSTS:0/u, "direct production wrapper must pin the audited public article count");
assert.match(deploy, /SUPABASE_CONTENT_EXPECTED_PAGES:6/u, "direct production wrapper must pin the audited public fixed-page count");
assert.doesNotMatch(deploy, /ESKOMI_WORKERS_PREVIEW_NO_INDEX|ESKOMI_PUBLIC_FRONTEND_PROXY_ORIGIN/u, "direct production wrapper must reject preview and proxy state by construction");

const rejected = spawnSync(process.execPath, [deployPath, "--root", root, "--profile", "eskomi-workers-deploy", "--", "--var", "CONTENT_DATA_SOURCE:supabase"], { cwd: projectDirectory, encoding: "utf8" });
assert.notEqual(rejected.status, 0, "direct production wrapper must reject arbitrary Worker variable overrides before invoking Wrangler");
assert.match(`${rejected.stderr}\n${rejected.stdout}`, /unsupported direct production deploy argument/u, "override rejection must be explicit");

const proxySource = readFileSync(join(projectDirectory, "proxy.ts"), "utf8");
const proxyOutput = ts.transpileModule(proxySource, {
  fileName: "proxy.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(proxyOutput, {
  module,
  exports: module.exports,
  Headers,
  URL,
  process: { env: { CONTENT_DATA_SOURCE: "supabase", SUPABASE_CONTENT_CUTOVER_APPROVED: "true" } },
  require(specifier) {
    if (specifier === "next/server") return { NextResponse: { next: () => ({ headers: new Headers(), cookies: { set() {} } }) } };
    if (specifier === "@/lib/dashboard/content-admin-auth") return {
      authorizeDashboardRequest: () => ({ status: 200 }),
      authorizeListingDashboardRequest: () => ({ status: 200 }),
      createDashboardSessionValue: () => null,
      dashboardSessionCookieName: () => "dashboard",
      isDashboardProtectedPath: () => false,
    };
    throw new Error(`unexpected import: ${specifier}`);
  },
});
const request = (hostname) => ({ nextUrl: new URL(`https://${hostname}/shops/example/`), headers: new Headers(), cookies: { get: () => undefined } });
assert.equal(module.exports.proxy(request("mens-esthe-kuchikomi.com")).headers.get("x-robots-tag"), null, "the production custom hostname must remain indexable");
assert.equal(module.exports.proxy(request("eskomi-workers-production.workers.dev")).headers.get("x-robots-tag"), "noindex, nofollow", "the production Worker workers.dev hostname must remain excluded");

console.log("Cloudflare direct Supabase production contract: PASS");
