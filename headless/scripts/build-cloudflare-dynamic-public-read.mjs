import assert from "node:assert/strict";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const buildBaseDirectory = join(projectDirectory, ".eskomi-cloudflare-dynamic-builds");
const prepareOnly = process.argv.includes("--prepare-only");
const release = process.argv.includes("--release");
const production = process.argv.includes("--production");
assert.ok(Number(release) + Number(production) <= 1, "choose at most one of --release or --production");
const target = production ? "production" : release ? "release" : "preview";
const runtimeConfig = production ? "wrangler.production.jsonc" : release ? "wrangler.jsonc" : "wrangler.preview.jsonc";

const publicReaderPaths = Object.freeze([
  "app/page.tsx",
  "lib/area-shop-ordering.ts",
  "lib/managed-shop-source.ts",
  "lib/priority-area-hub.ts",
  "lib/reviews/public-adapter.ts",
  "lib/wp/area-shop-order.ts",
  "lib/wp/area-shop-rankings.ts",
  "lib/wp/areas.ts",
  "lib/wp/home-featured-areas.ts",
  "lib/wp/pages.ts",
  "lib/wp/posts.ts",
  "lib/wp/reviews.ts",
  "lib/wp/shops.ts",
  "lib/analytics/snapshot-cache.ts",
]);

const instantRoutePaths = Object.freeze([
  "app/area/[slug]/community/page.tsx",
  "app/dashboard/listing-applications/[id]/page.tsx",
  "app/dashboard/partners/page.tsx",
  "app/dashboard/shops/[id]/edit/page.tsx",
  "app/dashboard/shops/[id]/page.tsx",
  "app/dashboard/shops/managed/[id]/page.tsx",
  "app/dashboard/shops/page.tsx",
  "app/listing/[id]/page.tsx",
  "app/partner/growth/page.tsx",
  "app/partner/growth/pop/page.tsx",
  "app/partner/listing/page.tsx",
  "app/partner/onboarding/page.tsx",
  "app/partner/page.tsx",
  "app/partner/settings/page.tsx",
  "app/partner/therapists/page.tsx",
  "app/partner/widget/[token]/page.tsx",
  "app/partner/workspace/[workspaceId]/page.tsx",
  "app/reviews/entry/[entryHandle]/page.tsx",
  "app/reviews/submit/page.tsx",
  "app/shops/[slug]/community/page.tsx",
  "app/shops/[slug]/page.tsx",
  "app/therapists/[assignmentId]/page.tsx",
]);

const mutationRoutePaths = Object.freeze([
  "app/api/revalidate/route.ts",
  "app/api/dashboard/managed-shops/route.ts",
  "app/api/dashboard/shops/[id]/official-facts/route.ts",
  "app/api/dashboard/reviews/moderation/route.ts",
]);

const workerImageRoutePaths = Object.freeze([
  "app/api/dashboard/managed-shops/[id]/asset/route.ts",
  "app/api/listing-applications/[id]/asset/route.ts",
  "app/api/partner/listing/banner/route.ts",
  "app/api/partner/therapists/photo/route.ts",
]);

const runtimePublicMetadataPaths = Object.freeze([
  "app/sitemap.ts",
  "app/[slug]/page.tsx",
]);

const copyDirectories = Object.freeze(["app", "components", "lib", "public", "scripts", "tests", "types"]);
const copyFiles = Object.freeze([
  "eslint.config.mjs",
  "next.config.ts",
  "open-next.config.ts",
  "package-lock.json",
  "package.json",
  "proxy.ts",
  "tsconfig.json",
  "wrangler.jsonc",
  "wrangler.preview.jsonc",
  "wrangler.production.jsonc",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceFiles(directory, relativeDirectory = "") {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = relativeDirectory ? join(relativeDirectory, entry.name) : entry.name;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if ([".next", ".open-next", ".wrangler", "node_modules"].includes(entry.name)) return [];
        return sourceFiles(absolutePath, relativePath);
      }
      return entry.isFile() ? [{ path: relativePath, sha256: sha256(readFileSync(absolutePath)) }] : [];
    });
}

function canonicalSourceSnapshot() {
  const entries = [
    ...copyDirectories.flatMap((directory) => sourceFiles(join(projectDirectory, directory), directory)),
    ...copyFiles.map((path) => ({ path, sha256: sha256(readFileSync(join(projectDirectory, path))) })),
  ].sort((left, right) => left.path.localeCompare(right.path));
  return { directories: [...copyDirectories], files: [...copyFiles], entries, sha256: sha256(JSON.stringify(entries)) };
}

function directorySha256(directory) {
  return sha256(JSON.stringify(sourceFiles(directory)));
}

function readSource(relativePath) {
  const absolutePath = join(projectDirectory, relativePath);
  assert.equal(existsSync(absolutePath), true, `expected source is missing: ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

function writeNewFile(path, contents) {
  assert.equal(existsSync(path), false, `derived build must not overwrite an existing file: ${relative(projectDirectory, path)}`);
  writeFileSync(path, contents, { encoding: "utf8", flag: "wx" });
}

function transformPublicReader(relativePath, original = readSource(relativePath)) {
  assert.match(original, /"use cache(?:: [^"]+)?";/u, `${relativePath} must contain a cache directive before transformation`);
  assert.match(original, /from "next\/cache"/u, `${relativePath} must import Cache Components helpers before transformation`);

  let transformed = original
    .replace(/^\s*"use cache(?:: [^"]+)?";\r?\n/gmu, "")
    .replace(/^\s*cacheLife\([^\n]*\);\r?\n/gmu, "")
    .replace(/^\s*cacheTag\([^\n]*\);\r?\n/gmu, "")
    .replace(/^\s*cacheTag\([\s\S]*?^\s*\);\r?\n/gmu, "")
    .replace(/^import \{ cacheLife, cacheTag \} from "next\/cache";\r?\n/gmu, "")
    .replace(/^import \{ cacheLife \} from "next\/cache";\r?\n/gmu, "");

  if (relativePath.startsWith("app/")) transformed = `export const dynamic = "force-dynamic";\n${transformed}`;

  assert.doesNotMatch(transformed, /"use cache(?:: [^"]+)?";|\bcacheLife\(|\bcacheTag\(/u, `${relativePath} retained an unsupported public cache instruction`);
  assert.doesNotMatch(transformed, /from "next\/cache"/u, `${relativePath} retained an unused Cache Components import`);
  return transformed;
}

function transformInstantRoute(relativePath, original = readSource(relativePath)) {
  assert.match(original, /^export const instant\s*=\s*false;\r?\n/mu, `${relativePath} must contain an instant export before Cache Components are disabled`);
  const transformed = original.replace(/^export const instant\s*=\s*false;\r?\n/gmu, "");
  assert.doesNotMatch(transformed, /^export const instant\s*=/mu, `${relativePath} retained a Cache Components-only instant export`);
  return transformed;
}

function transformMutationRoute(relativePath, original = readSource(relativePath)) {
  assert.match(original, /from "next\/cache"/u, `${relativePath} must import Next invalidation helpers before the Worker transform`);
  const transformed = original.replace(/from "next\/cache"/gu, 'from "@/lib/cloudflare-dynamic-public-cache"');
  assert.doesNotMatch(transformed, /from "next\/cache"/u, `${relativePath} retained a Next invalidation import`);
  return transformed;
}

function transformWorkerImageRoute(relativePath, original = readSource(relativePath)) {
  const sharpInspector = 'import { inspectListingImage } from "@/lib/listing-application-image";';
  assert.match(original, new RegExp(sharpInspector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), `${relativePath} must use the canonical Node image inspector before transformation`);
  const transformed = original.replace(sharpInspector, 'import { inspectWorkerListingImage as inspectListingImage } from "@/lib/cloudflare-worker-listing-image";');
  assert.doesNotMatch(transformed, /listing-application-image|\bsharp\b/u, `${relativePath} retained the native image inspector`);
  return transformed;
}

function transformRuntimePublicMetadata(relativePath, original = readSource(relativePath)) {
  assert.doesNotMatch(original, /^export const dynamic\s*=/mu, `${relativePath} must not already select a canonical runtime mode`);
  return `export const dynamic = "force-dynamic";\n${original}`;
}

function transformNextConfig() {
  const original = readSource("next.config.ts");
  assert.match(original, /cacheComponents:\s*true/u, "canonical Next config must keep Cache Components enabled for Node/Vercel");
  const transformed = original
    .replace('import type { NextConfig } from "next";\n', 'import { resolve } from "node:path";\nimport type { NextConfig } from "next";\n')
    .replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n  // Keep the standalone package rooted at this generated app, not its parent workspace.\n  outputFileTracingRoot: resolve(process.cwd()),\n  // OpenNext external Node middleware copies its trace through this Next output.\n  output: \"standalone\",")
    .replace(/cacheComponents:\s*true/u, "cacheComponents: false");
  assert.match(transformed, /cacheComponents:\s*false/u, "derived Next config must disable Cache Components");
  assert.match(transformed, /output:\s*"standalone"/u, "derived Next config must emit the standalone trace tree required by OpenNext");
  return transformed;
}

function transformPackageJson() {
  const packageJson = JSON.parse(readSource("package.json"));
  assert.equal(packageJson.scripts?.build, "next build", "canonical package build must retain the Node/Vercel Turbopack command");
  packageJson.scripts.build = "next build --webpack";
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function copyProjectSkeleton(derivedDirectory) {
  const generatedPaths = new Set(["next.config.ts", "package.json", ...publicReaderPaths, ...instantRoutePaths, ...mutationRoutePaths, ...workerImageRoutePaths, ...runtimePublicMetadataPaths]);
  for (const directory of copyDirectories) {
    const source = join(projectDirectory, directory);
    assert.equal(existsSync(source), true, `required source directory is missing: ${directory}`);
    cpSync(source, join(derivedDirectory, directory), {
      recursive: true,
      filter(sourcePath) {
        const sourceRelativePath = relative(projectDirectory, sourcePath);
        if (generatedPaths.has(sourceRelativePath)) return false;
        const name = sourcePath.split("/").at(-1);
        return name !== ".next" && name !== ".open-next" && name !== ".wrangler" && name !== "node_modules";
      },
    });
  }
  for (const file of copyFiles) {
    if (generatedPaths.has(file)) continue;
    const source = join(projectDirectory, file);
    if (existsSync(source)) cpSync(source, join(derivedDirectory, file));
  }
}

function linkReadOnlyDependencies(derivedDirectory) {
  const sourceDependencies = join(projectDirectory, "node_modules");
  assert.equal(existsSync(sourceDependencies), true, "the canonical dependency directory must exist before creating a derived source tree");
  const derivedDependencies = join(derivedDirectory, "node_modules");
  assert.equal(existsSync(derivedDependencies), false, "derived source must not replace a dependency directory");
  mkdirSync(derivedDependencies, { recursive: false });

  // The rest of the dependency graph remains read-only. Next itself must be a
  // physical derived copy so OpenNext can bundle the Worker-only replacement
  // for its otherwise-unreachable Node image optimizer without touching Node
  // deployments or the canonical dependency tree.
  for (const entry of readdirSync(sourceDependencies)) {
    if (entry === "next" || entry === ".bin") continue;
    const source = join(sourceDependencies, entry);
    const target = join(derivedDependencies, entry);
    const type = lstatSync(source).isDirectory() ? "dir" : "file";
    symlinkSync(source, target, type);
  }
  cpSync(join(sourceDependencies, "next"), join(derivedDependencies, "next"), {
    recursive: true,
    dereference: false,
  });
  mkdirSync(join(derivedDependencies, ".bin"), { recursive: false });
  symlinkSync("../next/dist/bin/next", join(derivedDependencies, ".bin", "next"), "file");
  patchDerivedNextImageOptimizer(derivedDependencies);
}

function patchDerivedNextImageOptimizer(derivedDependencies) {
  const nextServerPath = join(derivedDependencies, "next", "dist", "server", "next-server.js");
  const nextServer = readFileSync(nextServerPath, "utf8");
  const nativeOptimizerRequire = "require('./image-optimizer')";
  const occurrences = nextServer.split(nativeOptimizerRequire).length - 1;
  assert.equal(occurrences, 3, "the supported Next runtime must expose all Node image optimizer imports before the Worker patch");
  writeFileSync(nextServerPath, nextServer.replaceAll(nativeOptimizerRequire, "require('./cloudflare-image-optimizer-shim')"), { encoding: "utf8", flag: "w" });

  writeNewFile(join(derivedDependencies, "next", "dist", "server", "cloudflare-image-optimizer-shim.js"), `"use strict";
// Generated only for the Cloudflare Worker build. The worker template handles
// /_next/image before the Next server is reached, so these Node-only exports
// must remain unreachable. Keeping the boundary explicit prevents native sharp
// from entering the Worker bundle while retaining normal Next image behavior.
class ImageOptimizerCache {
  static validateParams() { throw new Error("Cloudflare image adapter should intercept /_next/image before Next"); }
  static getCacheKey() { throw new Error("Cloudflare image adapter should intercept /_next/image before Next"); }
}
class ImageError extends Error {}
function unreachable() { throw new Error("Cloudflare image adapter should intercept /_next/image before Next"); }
module.exports = { ImageOptimizerCache, ImageError, sendResponse: unreachable, imageOptimizer: unreachable, fetchExternalImage: unreachable, fetchInternalImage: unreachable };
`);
}

function writeDerivedNoopInvalidationModule(derivedDirectory) {
  const modulePath = join(derivedDirectory, "lib/cloudflare-dynamic-public-cache.ts");
  writeNewFile(modulePath, `/**\n * Generated only in the Cloudflare dynamic-public-read source tree. Public reads\n * have no cache entries there, so mutation invalidation is intentionally a no-op.\n */\nexport function revalidateTag(_tag: string, _profile: { expire: 0 }): void {}\nexport function revalidatePath(_path: string, _type?: "page" | "layout"): void {}\n`);
}

function writeDerivedPreviewStaticHeaders(derivedDirectory) {
  writeNewFile(join(derivedDirectory, "public", "_headers"), `/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: private, no-store
`);
}

function ensureNoSecretFiles(derivedDirectory) {
  for (const forbidden of [".env", ".env.local", ".dev.vars", ".npmrc"]) {
    assert.equal(existsSync(join(derivedDirectory, forbidden)), false, `derived source must not copy ${forbidden}`);
  }
}

function prepareDerivedSource() {
  mkdirSync(buildBaseDirectory, { recursive: true });
  const runId = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomUUID()}`;
  const derivedDirectory = join(buildBaseDirectory, `run-${runId}`);
  mkdirSync(derivedDirectory, { recursive: false });
  copyProjectSkeleton(derivedDirectory);
  linkReadOnlyDependencies(derivedDirectory);

  const generatedSources = new Map([
    ["next.config.ts", transformNextConfig()],
    ["package.json", transformPackageJson()],
  ]);
  for (const relativePath of publicReaderPaths) {
    generatedSources.set(relativePath, transformPublicReader(relativePath));
  }
  for (const relativePath of instantRoutePaths) {
    generatedSources.set(relativePath, transformInstantRoute(relativePath, generatedSources.get(relativePath)));
  }
  for (const relativePath of mutationRoutePaths) {
    generatedSources.set(relativePath, transformMutationRoute(relativePath));
  }
  for (const relativePath of workerImageRoutePaths) {
    generatedSources.set(relativePath, transformWorkerImageRoute(relativePath));
  }
  for (const relativePath of runtimePublicMetadataPaths) {
    generatedSources.set(relativePath, transformRuntimePublicMetadata(relativePath));
  }
  for (const [relativePath, contents] of generatedSources) {
    writeNewFile(join(derivedDirectory, relativePath), contents);
  }
  writeDerivedNoopInvalidationModule(derivedDirectory);
  // Static assets bypass Next middleware. The noindex header belongs only to
  // preview provenance and must never enter a release candidate.
  if (target === "preview") writeDerivedPreviewStaticHeaders(derivedDirectory);
  ensureNoSecretFiles(derivedDirectory);

  const source = canonicalSourceSnapshot();
  writeNewFile(join(derivedDirectory, "dynamic-source-manifest.json"), `${JSON.stringify({
    schema: 1,
    kind: "eskomi-cloudflare-dynamic-public-read",
    sourceRoot: relative(projectDirectory, derivedDirectory),
    source,
    target,
    runtimeConfig,
    runtimeConfigSha256: sha256(readSource(runtimeConfig)),
    publicReaderPaths,
    instantRoutePaths,
    mutationRoutePaths,
    workerImageRoutePaths,
    copiedSecretFiles: false,
  }, null, 2)}\n`);
  return derivedDirectory;
}

function buildDerivedSource(derivedDirectory) {
  const command = join(projectDirectory, "node_modules", ".bin", "opennextjs-cloudflare");
  const result = spawnSync(command, ["build"], {
    cwd: derivedDirectory,
    env: {
      ...process.env,
      WP_API_BASE_URL: "http://127.0.0.1:9/wp-json",
      NEXT_PUBLIC_WP_BASE_URL: "https://workers-fixture.invalid",
      ESKOMI_CLOUDFLARE_DYNAMIC_PUBLIC_READ: "1",
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  if (result.status === 0) {
    const workerPath = join(derivedDirectory, ".open-next", "worker.js");
    const worker = readFileSync(workerPath, "utf8");
    assert.doesNotMatch(worker, /(?:\\bsharp\\b|\\.node["'])/u, "the generated Worker must not retain a native sharp import or binding");
    writeNewFile(join(derivedDirectory, "dynamic-build-result.json"), `${JSON.stringify({
      schema: 1,
      status: "success",
      worker: ".open-next/worker.js",
      sourceManifestSha256: sha256(readFileSync(join(derivedDirectory, "dynamic-source-manifest.json"))),
      target,
      runtimeConfig,
      runtimeConfigSha256: sha256(readFileSync(join(derivedDirectory, runtimeConfig))),
      workerSha256: sha256(readFileSync(workerPath)),
      assetsSha256: directorySha256(join(derivedDirectory, ".open-next", "assets")),
    }, null, 2)}\n`);
  }
}

const derivedDirectory = prepareDerivedSource();
if (!prepareOnly) buildDerivedSource(derivedDirectory);
console.log(`ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=${derivedDirectory}`);
