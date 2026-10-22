import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const generatedBase = join(projectDirectory, ".eskomi-cloudflare-dynamic-builds");
const arguments_ = process.argv.slice(2);

if (arguments_.length !== 2 || arguments_[0] !== "--root") {
  throw new Error("usage: verify-cloudflare-dynamic-deploy-input.mjs --root <derived-root>");
}

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
assert.equal(result.previewConfigSha256, sha256(readFileSync(join(root, "wrangler.preview.jsonc"))), "derived preview config changed after build");
assert.equal(manifest.previewConfigSha256, sha256(readFileSync(join(projectDirectory, "wrangler.preview.jsonc"))), "canonical preview config no longer matches the generated build");

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

console.log(JSON.stringify({ root, sourceSha256: manifest.source.sha256, previewConfigSha256: result.previewConfigSha256, workerSha256: result.workerSha256, assetsSha256: result.assetsSha256 }));
