import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const generatedBase = join(projectDirectory, ".eskomi-cloudflare-dynamic-builds");
const arguments_ = process.argv.slice(2);

if (!((arguments_.length === 2 && arguments_[0] === "--root")
  || (arguments_.length === 4 && arguments_[0] === "--root" && arguments_[2] === "--target"))) {
  throw new Error("usage: verify-cloudflare-dynamic-deploy-input.mjs --root <derived-root> [--target preview|release|production]");
}
const target = arguments_[3] ?? "preview";
assert.ok(["preview", "release", "production"].includes(target), "deployment target must be preview, release, or production");
const runtimeConfig = target === "production" ? "wrangler.production.jsonc" : target === "release" ? "wrangler.jsonc" : "wrangler.preview.jsonc";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceFiles(directory, relativeDirectory = "") {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = relativeDirectory ? join(relativeDirectory, entry.name) : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if ([".next", ".open-next", ".wrangler", "node_modules"].includes(entry.name)) return [];
        return sourceFiles(absolute, path);
      }
      return entry.isFile() ? [{ path, sha256: sha256(readFileSync(absolute)) }] : [];
    });
}

function directorySha256(directory) {
  return sha256(JSON.stringify(sourceFiles(directory)));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const root = resolve(projectDirectory, arguments_[1]);
const rootRelative = relative(generatedBase, root);
assert.ok(/^run-[^/]+$/u.test(rootRelative), "deploy input must be a derived dynamic build root");

const manifestPath = join(root, "dynamic-source-manifest.json");
const resultPath = join(root, "dynamic-build-result.json");
assert.equal(existsSync(manifestPath), true, "derived build lacks dynamic-source-manifest.json");
assert.equal(existsSync(resultPath), true, "derived build lacks dynamic-build-result.json");

const manifest = readJson(manifestPath);
const result = readJson(resultPath);
assert.equal(manifest.kind, "eskomi-cloudflare-dynamic-public-read", "unexpected derived source kind");
assert.equal(result.status, "success", "derived build did not complete successfully");
assert.equal(result.sourceManifestSha256, sha256(readFileSync(manifestPath)), "source manifest hash changed after build");
assert.equal(manifest.target, target, "derived target does not match the intended deployment target");
assert.equal(result.target, target, "derived build result does not match the intended deployment target");
assert.equal(manifest.runtimeConfig, runtimeConfig, "derived provenance selected the wrong Worker config");
assert.equal(result.runtimeConfig, runtimeConfig, "derived build result selected the wrong Worker config");
assert.equal(result.runtimeConfigSha256, sha256(readFileSync(join(root, runtimeConfig))), "derived Worker config changed after build");
assert.equal(manifest.runtimeConfigSha256, sha256(readFileSync(join(projectDirectory, runtimeConfig))), "canonical Worker config no longer matches the generated build");

assert.ok(Array.isArray(manifest.source?.entries), "source provenance entries are required");
const currentEntries = manifest.source.directories
  .flatMap((directory) => sourceFiles(join(projectDirectory, directory), directory))
  .concat(manifest.source.files.map((path) => ({ path, sha256: sha256(readFileSync(join(projectDirectory, path))) })))
  .sort((left, right) => left.path.localeCompare(right.path));
assert.deepEqual(currentEntries, manifest.source.entries, "canonical source no longer matches the generated build");
assert.equal(manifest.source.sha256, sha256(JSON.stringify(currentEntries)), "canonical source hash no longer matches the generated build");

const workerPath = join(root, result.worker);
assert.equal(existsSync(workerPath), true, "derived Worker output is missing");
assert.equal(lstatSync(workerPath).isFile(), true, "derived Worker output is not a file");
assert.equal(result.workerSha256, sha256(readFileSync(workerPath)), "derived Worker output hash changed after build");
assert.equal(result.assetsSha256, directorySha256(join(root, ".open-next", "assets")), "derived asset output hash changed after build");

console.log(JSON.stringify({ root, target, sourceSha256: manifest.source.sha256, runtimeConfigSha256: result.runtimeConfigSha256, workerSha256: result.workerSha256, assetsSha256: result.assetsSha256 }));
