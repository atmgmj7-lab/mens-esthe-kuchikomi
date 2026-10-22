import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectDirectory, "package.json"), "utf8"));
const envExample = readFileSync(join(projectDirectory, ".env.example"), "utf8");

assert.equal(
  packageJson.scripts?.["workers:release-prepare"],
  "node scripts/build-cloudflare-dynamic-public-read.mjs --release --prepare-only",
  "release preparation must select the no-noindex derived source explicitly",
);

const prepared = spawnSync(
  process.execPath,
  [join(projectDirectory, "scripts", "build-cloudflare-dynamic-public-read.mjs"), "--release", "--prepare-only"],
  { cwd: projectDirectory, encoding: "utf8" },
);
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const root = `${prepared.stdout}\n${prepared.stderr}`.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu)?.[1]?.trim();
assert.ok(root, "release preparation must report its derived root");

const manifest = JSON.parse(readFileSync(join(root, "dynamic-source-manifest.json"), "utf8"));
assert.equal(manifest.target, "release", "release provenance must not be reusable as preview provenance");
assert.equal(manifest.runtimeConfig, "wrangler.jsonc", "release preparation must select the normal Worker config");
assert.equal(existsSync(join(root, "public", "_headers")), false, "release output must not ship the preview noindex header");

const deployGuard = readFileSync(join(projectDirectory, "scripts", "deploy-cloudflare-dynamic-release.mjs"), "utf8");
assert.match(deployGuard, /verify-cloudflare-dynamic-deploy-input\.mjs/u, "release deployment must verify the derived input");
assert.match(deployGuard, /--target", "release"/u, "release deployment must reject preview provenance");
assert.match(deployGuard, /ESKOMI_PUBLIC_FRONTEND_PROXY_ORIGIN/u, "release deployment must require the retained frontend origin explicitly");
assert.doesNotMatch(deployGuard, /CONTENT_DATA_SOURCE/u, "the short-term proxy release must not claim to operate an unverified Worker content source");
assert.match(envExample, /^ESKOMI_PUBLIC_FRONTEND_PROXY_ORIGIN=$/mu, "the short-term release origin must be documented as an unset server-only runtime variable");

console.log("Cloudflare release candidate contract: PASS");
