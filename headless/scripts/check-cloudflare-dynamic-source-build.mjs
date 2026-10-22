import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const generatorPath = resolve(projectDirectory, "scripts/build-cloudflare-dynamic-public-read.mjs");
const packagePath = join(projectDirectory, "package.json");
const gitignorePath = join(projectDirectory, ".gitignore");

assert.equal(
  existsSync(generatorPath),
  true,
  "Cloudflare dynamic public-read build must use a versioned physical-source generator",
);

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
assert.equal(
  packageJson.scripts?.["workers:dynamic-build"],
  "node scripts/build-cloudflare-dynamic-public-read.mjs",
  "dynamic Workers build must use the physical derived source generator",
);
assert.equal(
  packageJson.scripts?.["test:cloudflare-dynamic-public-read"],
  "node scripts/check-cloudflare-dynamic-source-build.mjs",
  "derived-source safety contract must be runnable through npm",
);
assert.match(
  readFileSync(gitignorePath, "utf8"),
  /^\.eskomi-cloudflare-dynamic-builds\/$/mu,
  "each derived Cloudflare source tree must be ignored",
);

const prepared = spawnSync(process.execPath, [generatorPath, "--prepare-only"], {
  cwd: projectDirectory,
  encoding: "utf8",
});
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const output = `${prepared.stdout}\n${prepared.stderr}`;
const match = output.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu);
assert.ok(match, "generator must report its unique derived source root");
const derivedRoot = match[1].trim();
assert.equal(existsSync(join(derivedRoot, "dynamic-source-manifest.json")), true, "derived source must carry an auditable manifest");
assert.equal(existsSync(join(derivedRoot, ".env")), false, "derived source must not copy .env");
assert.equal(existsSync(join(derivedRoot, ".env.local")), false, "derived source must not copy .env.local");
assert.equal(existsSync(join(derivedRoot, ".dev.vars")), false, "derived source must not copy .dev.vars");
assert.equal(existsSync(join(derivedRoot, ".npmrc")), false, "derived source must not copy .npmrc");
assert.equal(lstatSync(join(derivedRoot, "node_modules")).isDirectory(), true, "derived source must own a minimal dependency directory");
assert.equal(lstatSync(join(derivedRoot, "node_modules", "next")).isSymbolicLink(), false, "derived source must physically isolate Next before applying Worker-only patches");
assert.equal(lstatSync(join(derivedRoot, "node_modules", "fast-png")).isSymbolicLink(), true, "derived source must keep non-Next dependencies read-only links to the canonical tree");
const derivedNextServer = readFileSync(join(derivedRoot, "node_modules", "next", "dist", "server", "next-server.js"), "utf8");
assert.match(derivedNextServer, /cloudflare-image-optimizer-shim/u, "derived Next server must route unreachable Node image optimization imports to the Worker-only shim");
assert.equal(existsSync(join(derivedRoot, "node_modules", "next", "dist", "server", "cloudflare-image-optimizer-shim.js")), true, "derived Next package must provide the Worker-only image optimizer shim");
assert.match(readFileSync(join(derivedRoot, "next.config.ts"), "utf8"), /cacheComponents:\s*false/u, "derived config must disable Cache Components");
assert.match(readFileSync(join(derivedRoot, "next.config.ts"), "utf8"), /output:\s*"standalone"/u, "derived config must emit OpenNext's required standalone trace tree");
assert.match(readFileSync(join(derivedRoot, "next.config.ts"), "utf8"), /outputFileTracingRoot:\s*resolve\(process\.cwd\(\)\)/u, "derived config must root its standalone trace package at the generated app");
assert.equal(JSON.parse(readFileSync(join(derivedRoot, "package.json"), "utf8")).scripts?.build, "next build --webpack", "derived build must use Webpack because Turbopack rejects the read-only dependency link");

const originalHome = readFileSync(join(projectDirectory, "app/page.tsx"), "utf8");
const derivedHome = readFileSync(join(derivedRoot, "app/page.tsx"), "utf8");
assert.match(originalHome, /"use cache";/u, "canonical source must retain its Cache Components directive");
assert.doesNotMatch(derivedHome, /"use cache";|\bcacheLife\(|\bcacheTag\(/u, "derived public reader must remove Cache Components calls");
assert.doesNotMatch(derivedHome, /export const instant\s*=/u, "derived public route must not retain Cache Components-only instant config");

assert.match(
  readFileSync(join(derivedRoot, "app/sitemap.ts"), "utf8"),
  /^export const dynamic = "force-dynamic";/mu,
  "derived sitemap must read the runtime public-directory binding rather than a build-time static snapshot",
);

for (const staticAreaRoute of ["app/area/sakai/page.tsx", "app/area/shinosaka/page.tsx", "app/partner/onboarding/page.tsx"]) {
  assert.match(
    readFileSync(join(derivedRoot, staticAreaRoute), "utf8"),
    /export default/u,
    `${staticAreaRoute} must remain a generated route module`,
  );
  assert.doesNotMatch(readFileSync(join(derivedRoot, staticAreaRoute), "utf8"), /export const instant\s*=/u, `${staticAreaRoute} must remove Cache Components-only instant config`);
}

for (const relativePath of ["lib/analytics/snapshot-cache.ts", "lib/wp/shops.ts"]) {
  assert.doesNotMatch(readFileSync(join(derivedRoot, relativePath), "utf8"), /"use cache(?:: [^"]+)?";|\bcacheLife\(|\bcacheTag\(/u, `${relativePath} must not retain a Cache Components directive in conventional dynamic mode`);
}

for (const mutationRoute of [
  "app/api/revalidate/route.ts",
  "app/api/dashboard/managed-shops/route.ts",
  "app/api/dashboard/shops/[id]/official-facts/route.ts",
  "app/api/dashboard/reviews/moderation/route.ts",
]) {
  const source = readFileSync(join(derivedRoot, mutationRoute), "utf8");
  assert.match(source, /@\/lib\/cloudflare-dynamic-public-cache/u, `${mutationRoute} must use the Worker-only no-op invalidation adapter`);
}

for (const workerImageRoute of [
  "app/api/dashboard/managed-shops/[id]/asset/route.ts",
  "app/api/listing-applications/[id]/asset/route.ts",
  "app/api/partner/listing/banner/route.ts",
  "app/api/partner/therapists/photo/route.ts",
]) {
  const canonical = readFileSync(join(projectDirectory, workerImageRoute), "utf8");
  const derived = readFileSync(join(derivedRoot, workerImageRoute), "utf8");
  assert.match(canonical, /listing-application-image/u, `${workerImageRoute} must retain the canonical Node image inspector`);
  assert.match(derived, /cloudflare-worker-listing-image/u, `${workerImageRoute} must use the derived Worker image inspector`);
  assert.doesNotMatch(derived, /listing-application-image|\bsharp\b/u, `${workerImageRoute} must not bundle native sharp`);
}
assert.doesNotMatch(readFileSync(join(derivedRoot, "lib/cloudflare-worker-listing-image.mjs"), "utf8"), /\bsharp\b/u, "the Worker image adapter must not import native sharp");

console.log("Eskomi Cloudflare dynamic public-read source contract: PASS");
