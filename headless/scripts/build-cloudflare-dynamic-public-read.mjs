import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const buildBaseDirectory = join(projectDirectory, ".eskomi-cloudflare-dynamic-builds");
const prepareOnly = process.argv.includes("--prepare-only");

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
]);

const dynamicPagePaths = Object.freeze([
  "app/page.tsx",
  "app/[slug]/page.tsx",
  "app/area/[slug]/page.tsx",
  "app/area/[slug]/community/page.tsx",
  "app/area/sakai/page.tsx",
  "app/area/shinosaka/page.tsx",
  "app/column/page.tsx",
  "app/column/[slug]/page.tsx",
  "app/partner/register/page.tsx",
  "app/reviews/page.tsx",
  "app/reviews/submit/page.tsx",
  "app/shops/page.tsx",
  "app/shops/[slug]/page.tsx",
  "app/shops/[slug]/community/page.tsx",
  "app/shops/[slug]/reviews/page.tsx",
]);

const mutationRoutePaths = Object.freeze([
  "app/api/revalidate/route.ts",
  "app/api/dashboard/managed-shops/route.ts",
  "app/api/dashboard/shops/[id]/official-facts/route.ts",
  "app/api/dashboard/reviews/moderation/route.ts",
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
]);

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
  assert.match(original, /"use cache";/u, `${relativePath} must contain a cache directive before transformation`);
  assert.match(original, /from "next\/cache"/u, `${relativePath} must import Cache Components helpers before transformation`);

  let transformed = original
    .replace(/^\s*"use cache";\r?\n/gmu, "")
    .replace(/^\s*cacheLife\([^\n]*\);\r?\n/gmu, "")
    .replace(/^\s*cacheTag\([^\n]*\);\r?\n/gmu, "")
    .replace(/^\s*cacheTag\([\s\S]*?^\s*\);\r?\n/gmu, "")
    .replace(/^import \{ cacheLife, cacheTag \} from "next\/cache";\r?\n/gmu, "")
    .replace(/^import \{ cacheLife \} from "next\/cache";\r?\n/gmu, "");

  assert.doesNotMatch(transformed, /"use cache";|\bcacheLife\(|\bcacheTag\(/u, `${relativePath} retained an unsupported public cache instruction`);
  assert.doesNotMatch(transformed, /from "next\/cache"/u, `${relativePath} retained an unused Cache Components import`);
  return transformed;
}

function transformDynamicPage(relativePath, original = readSource(relativePath)) {
  assert.doesNotMatch(original, /^"use client";/mu, `${relativePath} must be a server route before adding the dynamic route config`);
  if (/export const instant\s*=\s*false;/u.test(original)) return original;
  const insertionIndex = original.indexOf("\n");
  assert.notEqual(insertionIndex, -1, `${relativePath} must have an import header before adding its dynamic route config`);
  const transformed = `${original.slice(0, insertionIndex + 1)}export const instant = false;\n${original.slice(insertionIndex + 1)}`;
  assert.match(transformed, /export const instant\s*=\s*false;/u, `${relativePath} did not receive its Cloudflare dynamic route config`);
  return transformed;
}

function transformMutationRoute(relativePath, original = readSource(relativePath)) {
  assert.match(original, /from "next\/cache"/u, `${relativePath} must import Next invalidation helpers before the Worker transform`);
  const transformed = original.replace(/from "next\/cache"/gu, 'from "@/lib/cloudflare-dynamic-public-cache"');
  assert.doesNotMatch(transformed, /from "next\/cache"/u, `${relativePath} retained a Next invalidation import`);
  return transformed;
}

function transformNextConfig() {
  const original = readSource("next.config.ts");
  assert.match(original, /const nextConfig: NextConfig = \{/u, "canonical Next config must expose its config object");
  assert.doesNotMatch(original, /turbopack:\s*\{\s*root:/u, "canonical Next config must not be rewritten for the derived build root");
  const transformed = original
    .replace('import type { NextConfig } from "next";\n', 'import { resolve } from "node:path";\nimport type { NextConfig } from "next";\n')
    .replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n  // This run directory is two levels below the canonical dependency root.\n  turbopack: { root: resolve(process.cwd(), \"../..\") },");
  assert.match(transformed, /turbopack:\s*\{\s*root:/u, "derived Next config must set an enclosing Turbopack root");
  return transformed;
}

function transformPackageJson() {
  const packageJson = JSON.parse(readSource("package.json"));
  assert.equal(packageJson.scripts?.build, "next build", "canonical package build must retain the Node/Vercel Turbopack command");
  packageJson.scripts.build = "next build --webpack";
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function copyProjectSkeleton(derivedDirectory) {
  const generatedPaths = new Set(["next.config.ts", "package.json", ...publicReaderPaths, ...dynamicPagePaths, ...mutationRoutePaths]);
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

function copyReadOnlyDependencies(derivedDirectory) {
  const sourceDependencies = join(projectDirectory, "node_modules");
  assert.equal(existsSync(sourceDependencies), true, "the canonical dependency directory must exist before creating a derived source tree");
  const derivedDependencies = join(derivedDirectory, "node_modules");
  assert.equal(existsSync(derivedDependencies), false, "derived source must not replace a dependency directory");
  cpSync(sourceDependencies, derivedDependencies, { recursive: true, force: false, errorOnExist: true });
}

function writeDerivedNoopInvalidationModule(derivedDirectory) {
  const modulePath = join(derivedDirectory, "lib/cloudflare-dynamic-public-cache.ts");
  writeNewFile(modulePath, `/**\n * Generated only in the Cloudflare dynamic-public-read source tree. Public reads\n * have no cache entries there, so mutation invalidation is intentionally a no-op.\n */\nexport function revalidateTag(_tag: string, _profile: { expire: 0 }): void {}\nexport function revalidatePath(_path: string, _type?: "page" | "layout"): void {}\n`);
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
  copyReadOnlyDependencies(derivedDirectory);

  const generatedSources = new Map([
    ["next.config.ts", transformNextConfig()],
    ["package.json", transformPackageJson()],
  ]);
  for (const relativePath of publicReaderPaths) {
    generatedSources.set(relativePath, transformPublicReader(relativePath));
  }
  for (const relativePath of dynamicPagePaths) {
    generatedSources.set(relativePath, transformDynamicPage(relativePath, generatedSources.get(relativePath)));
  }
  for (const relativePath of mutationRoutePaths) {
    generatedSources.set(relativePath, transformMutationRoute(relativePath));
  }
  for (const [relativePath, contents] of generatedSources) {
    writeNewFile(join(derivedDirectory, relativePath), contents);
  }
  writeDerivedNoopInvalidationModule(derivedDirectory);
  ensureNoSecretFiles(derivedDirectory);

  writeNewFile(join(derivedDirectory, "dynamic-source-manifest.json"), `${JSON.stringify({
    schema: 1,
    kind: "eskomi-cloudflare-dynamic-public-read",
    sourceRoot: relative(projectDirectory, derivedDirectory),
    publicReaderPaths,
    dynamicPagePaths,
    mutationRoutePaths,
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
    writeNewFile(join(derivedDirectory, "dynamic-build-result.json"), `${JSON.stringify({
      schema: 1,
      status: "success",
      worker: ".open-next/worker.js",
    }, null, 2)}\n`);
  }
}

const derivedDirectory = prepareDerivedSource();
if (!prepareOnly) buildDerivedSource(derivedDirectory);
console.log(`ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=${derivedDirectory}`);
