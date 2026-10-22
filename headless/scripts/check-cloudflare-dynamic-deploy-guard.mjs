import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const generatorPath = join(scriptsDirectory, "build-cloudflare-dynamic-public-read.mjs");
const verifierPath = join(scriptsDirectory, "verify-cloudflare-dynamic-deploy-input.mjs");
const deployPath = join(scriptsDirectory, "deploy-cloudflare-dynamic-preview.mjs");

assert.equal(existsSync(verifierPath), true, "a preview deployment must require the dynamic-bundle verifier");
assert.equal(existsSync(deployPath), true, "preview deployment must use the guarded dynamic-bundle wrapper");
const deploySource = readFileSync(deployPath, "utf8");
assert.match(deploySource, /verify-cloudflare-dynamic-deploy-input\.mjs/u, "deploy wrapper must run the dynamic-bundle verifier");
assert.match(deploySource, /--strict/u, "deploy wrapper must reject conflicting remote changes");
assert.match(deploySource, /unsupported preview deploy argument/u, "deploy wrapper must reject every configuration override");

const build = spawnSync(process.execPath, [generatorPath], { cwd: projectDirectory, encoding: "utf8" });
assert.equal(build.status, 0, build.stderr || build.stdout);
const root = `${build.stdout}\n${build.stderr}`.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu)?.[1]?.trim();
assert.ok(root, "dynamic build must report its generated root");

const verified = spawnSync(process.execPath, [verifierPath, "--root", root], { cwd: projectDirectory, encoding: "utf8" });
assert.equal(verified.status, 0, verified.stderr || verified.stdout);

const canonical = spawnSync(process.execPath, [verifierPath, "--root", projectDirectory], { cwd: projectDirectory, encoding: "utf8" });
assert.notEqual(canonical.status, 0, "canonical source output must never be deployable as the Workers preview");
assert.match(`${canonical.stderr}\n${canonical.stdout}`, /derived dynamic build root/u, "canonical rejection must name the required generated root");

const nested = spawnSync(process.execPath, [verifierPath, "--root", join(root, "nested")], { cwd: projectDirectory, encoding: "utf8" });
assert.notEqual(nested.status, 0, "a nested path must not be treated as a derived build root");
assert.match(`${nested.stderr}\n${nested.stdout}`, /derived dynamic build root/u, "nested rejection must name the required generated root");

const override = spawnSync(process.execPath, [deployPath, "--root", root, "--profile", "eskomi-workers-deploy", "--", "--var", "CONTENT_DATA_SOURCE:supabase"], { cwd: projectDirectory, encoding: "utf8" });
assert.notEqual(override.status, 0, "the deploy wrapper must reject a configuration override before invoking Wrangler");
assert.match(`${override.stderr}\n${override.stdout}`, /unsupported preview deploy argument/u, "configuration override rejection must be explicit");

console.log("Eskomi Cloudflare dynamic deploy guard: PASS");
